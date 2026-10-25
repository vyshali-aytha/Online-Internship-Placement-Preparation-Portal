import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';

import { createRecruiterRequestRouter } from '../server/recruiter-requests.js';

// In-memory stand-in for the recruiter_requests table.
const rows = [];

const fakePool = {
  async execute(sql, values = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (normalized.startsWith('INSERT INTO RECRUITER_REQUESTS')) {
      const [full_name, email, company_name, password_hash] = values;

      if (rows.some((row) => row.email === email)) {
        const error = new Error('Duplicate entry');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }

      // The SQL itself must hard-code PENDING.
      assert.ok(normalized.includes("'PENDING'"));

      const row = {
        id: rows.length + 1,
        full_name,
        email,
        company_name,
        password_hash,
        status: 'PENDING',
      };
      rows.push(row);

      return [{ insertId: row.id }, []];
    }

    throw new Error(`Unexpected SQL in test database: ${sql}`);
  },
};

const app = express();
app.use(express.json());
app.use('/api', createRecruiterRequestRouter(fakePool, { limit: 1000 }));
app.use((_error, _req, res, _next) => {
  return res.status(500).json({ message: 'Unexpected test server error.' });
});

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
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function submit(body) {
  const response = await fetch(`${baseUrl}/api/recruiter-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const valid = {
  fullName: 'Test Recruiter',
  email: 'Recruiter@Acme.com',
  companyName: 'Acme Ltd',
  password: 'RecruiterPass123!',
};

test('a prospective recruiter can submit an account request', async () => {
  const result = await submit(valid);
  assert.equal(result.status, 201);
  assert.equal(result.body.email, 'recruiter@acme.com');
});

test('a new request is PENDING even if the client asks for APPROVED', async () => {
  const result = await submit({
    ...valid,
    email: 'sneaky@acme.com',
    status: 'APPROVED',
    role: 'ADMIN',
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'PENDING');
  assert.equal(rows.find((r) => r.email === 'sneaky@acme.com').status, 'PENDING');
});

test('the response and stored data never contain the plain password', async () => {
  const result = await submit({ ...valid, email: 'hash@acme.com' });
  assert.equal(result.status, 201);
  assert.equal(JSON.stringify(result.body).includes(valid.password), false);
  assert.equal(result.body.password_hash, undefined);

  const stored = rows.find((r) => r.email === 'hash@acme.com');
  assert.notEqual(stored.password_hash, valid.password);
  assert.equal(await bcrypt.compare(valid.password, stored.password_hash), true);
});

test('submitting grants no token and no recruiter privileges', async () => {
  const result = await submit({ ...valid, email: 'notoken@acme.com' });
  assert.equal(result.status, 201);
  assert.equal(result.body.token, undefined);
  assert.equal(result.body.role, undefined);
});

test('a duplicate email is rejected with 409', async () => {
  const result = await submit(valid);
  assert.equal(result.status, 409);
});

test('invalid input is rejected with 400', async () => {
  assert.equal((await submit({})).status, 400);
  assert.equal((await submit({ ...valid, email: 'not-an-email' })).status, 400);
  assert.equal((await submit({ ...valid, email: 'short@acme.com', password: 'short' })).status, 400);
  assert.equal((await submit({ ...valid, email: 'x@acme.com', fullName: 'A' })).status, 400);
});
