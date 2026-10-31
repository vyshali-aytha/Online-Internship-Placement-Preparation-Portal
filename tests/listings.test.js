import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { signJwt } from '../server/security.js';
import {
  createListingsRouter,
  buildListingsQuery,
  parseListingFilters,
} from '../server/listings.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

// ---- F-007: active listings ------------------------------------------------

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

let lastCall = null;
const fakePool = {
  async execute(sql, params = []) {
    lastCall = { sql, params };
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

test('only OPEN listings are queried, so inactive listings are not shown', async () => {
  const { sql } = buildListingsQuery({});
  assert.match(sql, /WHERE status = 'OPEN'/);
  assert.doesNotMatch(sql, /DRAFT|CLOSED/);

  // Filters never widen the query beyond OPEN listings.
  const filtered = buildListingsQuery({ role: 'x', location: 'y', minCgpa: 7 });
  assert.match(filtered.sql, /WHERE status = 'OPEN' AND/);
});

test('only logged-in students can view listings', async () => {
  assert.equal((await get('/api/student/listings')).status, 401);
  assert.equal((await get('/api/student/listings', signJwt('17', 'RECRUITER'))).status, 403);
});

// ---- F-008: filters --------------------------------------------------------

test('students can filter listings by role', async () => {
  await get('/api/student/listings?role=Backend', student());
  assert.match(lastCall.sql, /AND title LIKE \?/);
  assert.deepEqual(lastCall.params, ['%Backend%']);
});

test('students can filter listings by location', async () => {
  await get('/api/student/listings?location=Pune', student());
  assert.match(lastCall.sql, /AND location LIKE \?/);
  assert.deepEqual(lastCall.params, ['%Pune%']);
});

test('students can specify a minimum CGPA, and listings with no requirement stay included', async () => {
  await get('/api/student/listings?minCgpa=7.5', student());
  assert.match(lastCall.sql, /AND \(min_cgpa IS NULL OR min_cgpa <= \?\)/);
  assert.deepEqual(lastCall.params, [7.5]);
});

test('filters combine so results match every selected filter', async () => {
  await get('/api/student/listings?role=intern&location=Bengaluru&minCgpa=8', student());
  assert.match(lastCall.sql, /title LIKE \?.*location LIKE \?.*min_cgpa <= \?/s);
  assert.deepEqual(lastCall.params, ['%intern%', '%Bengaluru%', 8]);
});

test('empty filters are ignored and return the full active list', async () => {
  await get('/api/student/listings?role=&location=%20&minCgpa=', student());
  assert.deepEqual(lastCall.params, []);
  assert.equal(lastCall.sql, buildListingsQuery({}).sql);
});

test('typed % and _ are matched literally, not as wildcards', () => {
  const { params } = buildListingsQuery({ role: '100%_dev' });
  assert.deepEqual(params, ['%100\\%\\_dev%']);
});

test('filter values are always sent as parameters, never joined into the SQL', () => {
  const evil = "x' OR '1'='1";
  const { sql, params } = buildListingsQuery({ role: evil, location: evil });
  assert.equal(sql.includes(evil), false);
  assert.equal(params.length, 2);
});

test('invalid filters are rejected with 400', async () => {
  for (const query of ['minCgpa=abc', 'minCgpa=11', 'minCgpa=-1', 'role=a&role=b', `role=${'x'.repeat(101)}`]) {
    const res = await get(`/api/student/listings?${query}`, student());
    assert.equal(res.status, 400, query);
  }
  assert.ok(parseListingFilters({ minCgpa: '10' }).filters);
  assert.ok(parseListingFilters({ minCgpa: '0' }).filters);
});
