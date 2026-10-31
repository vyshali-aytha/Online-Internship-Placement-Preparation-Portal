import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { signJwt } from '../server/security.js';
import { createRecruiterListingsRouter } from '../server/recruiter-listings.js';
import { createRecruiterApprovalStatusResolver } from '../server/recruiterApproval.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

// recruiter_requests rows: 17 approved, 18 pending, 19 approved (a second recruiter)
const recruiterStatus = { 17: 'APPROVED', 18: 'PENDING', 19: 'APPROVED' };
const listings = [];

const fakePool = {
  async execute(sql, values = []) {
    const q = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (q.startsWith('SELECT STATUS FROM RECRUITER_REQUESTS WHERE ID = ?')) {
      const status = recruiterStatus[values[0]];
      return [status ? [{ status }] : [], []];
    }

    if (q.startsWith('INSERT INTO INTERNSHIP_LISTINGS')) {
      const [recruiter_id, title, company_name, description, location,
        listing_type, min_cgpa, status] = values;
      const row = {
        id: listings.length + 1, recruiter_id, title, company_name,
        description, location, listing_type, min_cgpa, status,
        created_at: '2026-10-30 00:00:00',
      };
      listings.push(row);
      return [{ insertId: row.id }, []];
    }

    if (q.startsWith('SELECT ID, STATUS FROM INTERNSHIP_LISTINGS WHERE ID = ? AND RECRUITER_ID = ?')) {
      const row = listings.find((l) => l.id === values[0] && l.recruiter_id === values[1]);
      return [row ? [{ id: row.id, status: row.status }] : [], []];
    }

    if (q.startsWith("UPDATE INTERNSHIP_LISTINGS SET STATUS = 'OPEN'")) {
      const row = listings.find((l) => l.id === values[0] && l.recruiter_id === values[1] && l.status === 'DRAFT');
      if (row) row.status = 'OPEN';
      return [{ affectedRows: row ? 1 : 0 }, []];
    }

    if (q.startsWith("UPDATE INTERNSHIP_LISTINGS SET STATUS = 'CLOSED'")) {
      const row = listings.find((l) => l.id === values[0] && l.recruiter_id === values[1]);
      if (row) row.status = 'CLOSED';
      return [{ affectedRows: row ? 1 : 0 }, []];
    }

    if (q.includes('FROM INTERNSHIP_LISTINGS WHERE RECRUITER_ID = ?')) {
      return [listings.filter((l) => l.recruiter_id === values[0]), []];
    }

    throw new Error(`Unexpected SQL in test database: ${sql}`);
  },
};

const app = express();
app.use(express.json());
app.locals.getRecruiterApprovalStatus = createRecruiterApprovalStatusResolver(fakePool);
app.use('/api', createRecruiterListingsRouter(fakePool));
app.use((_error, _req, res, _next) => res.status(500).json({ message: 'Unexpected test server error.' }));

let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});

async function api(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}

const approved = () => signJwt('17', 'RECRUITER');
const otherApproved = () => signJwt('19', 'RECRUITER');
const pending = () => signJwt('18', 'RECRUITER');

const valid = {
  title: 'Backend Intern',
  companyName: 'Acme Ltd',
  description: 'Build REST APIs with Node.js.',
  location: 'Bengaluru',
  listingType: 'Internship',
  minCgpa: 7.5,
};

test('an approved recruiter can create a listing with the required details', async () => {
  const res = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body: valid });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'DRAFT');

  const stored = listings.find((l) => l.id === res.body.id);
  assert.equal(stored.title, 'Backend Intern');
  assert.equal(stored.listing_type, 'Internship');
  assert.equal(stored.min_cgpa, 7.5);
});

test('the owner and status come from the token, not from the request body', async () => {
  const res = await api('/api/recruiter/listings', {
    token: approved(), method: 'POST',
    body: { ...valid, recruiterId: 19, recruiter_id: 19, status: 'OPEN' },
  });
  assert.equal(res.status, 201);
  const stored = listings.find((l) => l.id === res.body.id);
  assert.equal(stored.recruiter_id, 17);
  assert.equal(stored.status, 'DRAFT');
});

test('a recruiter can publish a draft and it becomes OPEN (visible to students)', async () => {
  const created = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body: valid });
  const published = await api(`/api/recruiter/listings/${created.body.id}/publish`, {
    token: approved(), method: 'POST',
  });
  assert.equal(published.status, 200);
  // Students are shown listings where status = 'OPEN'.
  assert.equal(listings.find((l) => l.id === created.body.id).status, 'OPEN');
});

test('a listing can be created and published in one step', async () => {
  const res = await api('/api/recruiter/listings', {
    token: approved(), method: 'POST', body: { ...valid, publish: true },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'OPEN');
});

test('an unapproved recruiter cannot create or publish listings', async () => {
  const before = listings.length;
  const create = await api('/api/recruiter/listings', { token: pending(), method: 'POST', body: valid });
  assert.equal(create.status, 403);
  assert.equal(listings.length, before);

  const draft = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body: valid });
  const publish = await api(`/api/recruiter/listings/${draft.body.id}/publish`, {
    token: pending(), method: 'POST',
  });
  assert.equal(publish.status, 403);
  assert.equal(listings.find((l) => l.id === draft.body.id).status, 'DRAFT');
});

test('students and anonymous users cannot use recruiter listing routes', async () => {
  assert.equal((await api('/api/recruiter/listings')).status, 401);
  const student = await api('/api/recruiter/listings', { token: signJwt('42', 'STUDENT'), method: 'POST', body: valid });
  assert.equal(student.status, 403);
});

test("a recruiter cannot publish or close another recruiter's listing", async () => {
  const draft = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body: valid });
  const publish = await api(`/api/recruiter/listings/${draft.body.id}/publish`, {
    token: otherApproved(), method: 'POST',
  });
  assert.equal(publish.status, 404);
  const close = await api(`/api/recruiter/listings/${draft.body.id}/close`, {
    token: otherApproved(), method: 'POST',
  });
  assert.equal(close.status, 404);
  assert.equal(listings.find((l) => l.id === draft.body.id).status, 'DRAFT');
});

test('a closed listing cannot be published again, and closing hides it from students', async () => {
  const created = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body: { ...valid, publish: true } });
  const closed = await api(`/api/recruiter/listings/${created.body.id}/close`, { token: approved(), method: 'POST' });
  assert.equal(closed.status, 200);
  assert.equal(listings.find((l) => l.id === created.body.id).status, 'CLOSED');

  const again = await api(`/api/recruiter/listings/${created.body.id}/publish`, { token: approved(), method: 'POST' });
  assert.equal(again.status, 409);
});

test('a recruiter only sees their own listings', async () => {
  await api('/api/recruiter/listings', { token: otherApproved(), method: 'POST', body: { ...valid, title: 'Other Recruiter Role' } });
  const mine = await api('/api/recruiter/listings', { token: approved() });
  assert.equal(mine.status, 200);
  assert.ok(mine.body.listings.length > 0);
  assert.ok(mine.body.listings.every((l) => l.recruiter_id === 17));
});

test('invalid listing details are rejected with 400', async () => {
  const bad = [
    {},
    { ...valid, title: '' },
    { ...valid, listingType: 'Volunteer' },
    { ...valid, minCgpa: 11 },
    { ...valid, minCgpa: 'abc' },
    { ...valid, location: '' },
  ];
  for (const body of bad) {
    const res = await api('/api/recruiter/listings', { token: approved(), method: 'POST', body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const badId = await api('/api/recruiter/listings/abc/publish', { token: approved(), method: 'POST' });
  assert.equal(badId.status, 400);
});
