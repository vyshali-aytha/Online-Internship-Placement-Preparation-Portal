import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { signJwt } from '../server/security.js';
import { createListingsRouter, LISTINGS_SQL } from '../server/listings.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

// What the database returns for the "active listings" query: OPEN rows only.
const openRows = [
  {
    id: 2, title: 'Data Analyst (Placement)', company_name: 'Globex',
    description: 'Full-time analytics role.', location: 'Pune',
    listing_type: 'Placement', min_cgpa: '8.00', created_at: '2026-10-30 10:00:00',
  },
  {
    id: 1, title: 'Backend Intern', company_name: 'Acme Ltd',
    description: 'Build REST APIs.', location: 'Bengaluru',
    listing_type: 'Internship', min_cgpa: null, created_at: '2026-10-29 10:00:00',
  },
];

let lastSql = '';
const fakePool = {
  async execute(sql) {
    lastSql = sql;
    return [openRows, []];
  },
};

const app = express();
app.use('/api/student', createListingsRouter(fakePool));
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

async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null };
}

const student = () => signJwt('42', 'STUDENT');

test('students can view available internship and placement listings', async () => {
  const res = await get('/api/student/listings', student());
  assert.equal(res.status, 200);
  const types = res.body.listings.map((l) => l.listing_type);
  assert.ok(types.includes('Internship'));
  assert.ok(types.includes('Placement'));
});

test('each listing includes its relevant details', async () => {
  const res = await get('/api/student/listings', student());
  for (const listing of res.body.listings) {
    for (const field of ['id', 'title', 'company_name', 'description', 'location', 'listing_type', 'min_cgpa', 'created_at']) {
      assert.ok(field in listing, `missing ${field}`);
    }
  }
});

test('only OPEN listings are queried, so inactive listings are not shown', () => {
  assert.match(LISTINGS_SQL, /WHERE status = 'OPEN'/);
  assert.doesNotMatch(LISTINGS_SQL, /DRAFT|CLOSED/);
});

test('the query is run through the database layer when listings are requested', async () => {
  lastSql = '';
  await get('/api/student/listings', student());
  assert.equal(lastSql, LISTINGS_SQL);
});

test('only logged-in students can view listings', async () => {
  assert.equal((await get('/api/student/listings')).status, 401);
  assert.equal((await get('/api/student/listings', signJwt('17', 'RECRUITER'))).status, 403);
});
