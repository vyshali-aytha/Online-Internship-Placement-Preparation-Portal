import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

import {
  signJwt,
  requireAuth,
  requireRoles,
  requireApprovedRecruiter,
} from '../server/security.js';
import authRouter from '../server/auth.js';
import { pool } from '../server/db.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

const approvalStatuses = new Map();
const app = express();
app.use('/api/auth', authRouter);

app.locals.getRecruiterApprovalStatus = async (recruiterId) =>
  approvalStatuses.get(recruiterId);

app.get(
  '/api/student/profile',
  requireAuth,
  requireRoles('STUDENT'),
  (req, res) => res.json({ id: req.auth.sub, role: req.auth.role })
);

app.get(
  '/api/recruiter/listings',
  requireAuth,
  requireRoles('RECRUITER'),
  requireApprovedRecruiter,
  (req, res) => res.json({ id: req.auth.sub, role: req.auth.role })
);

app.get(
  '/api/admin/reports',
  requireAuth,
  requireRoles('ADMIN'),
  (req, res) => res.json({ id: req.auth.sub, role: req.auth.role })
);

let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  server.listen(0, '127.0.0.1');

  await once(server, 'listening');

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

async function request(path, token) {
  const headers = {};

  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, { headers });

  return {
    status: response.status,
    body: await response.json(),
  };
}

test('HTTP routes enforce role and live recruiter approval checks', async () => {
  const studentToken = signJwt('student-1', 'STUDENT');
  const recruiterToken = signJwt('recruiter-1', 'RECRUITER');
  const adminToken = signJwt('admin-1', 'ADMIN');

  const unauthenticated = await request('/api/student/profile');
  assert.equal(unauthenticated.status, 401);

  const studentAllowed = await request('/api/student/profile', studentToken);
  assert.equal(studentAllowed.status, 200);
  assert.equal(studentAllowed.body.role, 'STUDENT');

  const studentDeniedAdmin = await request('/api/admin/reports', studentToken);
  assert.equal(studentDeniedAdmin.status, 403);

  const adminAllowed = await request('/api/admin/reports', adminToken);
  assert.equal(adminAllowed.status, 200);
  assert.equal(adminAllowed.body.role, 'ADMIN');

  const adminDeniedStudent = await request('/api/student/profile', adminToken);
  assert.equal(adminDeniedStudent.status, 403);

  approvalStatuses.set('recruiter-1', 'PENDING');
  const pendingDenied = await request('/api/recruiter/listings', recruiterToken);
  assert.equal(pendingDenied.status, 403);

  approvalStatuses.set('recruiter-1', 'APPROVED');
  const approvedAllowed = await request('/api/recruiter/listings', recruiterToken);
  assert.equal(approvedAllowed.status, 200);

  // Revocation is checked again on the next request, rather than trusting
  // an approval value embedded in a potentially stale JWT.
  approvalStatuses.set('recruiter-1', 'REJECTED');
  const revokedDenied = await request('/api/recruiter/listings', recruiterToken);
  assert.equal(revokedDenied.status, 403);

  const resolver = app.locals.getRecruiterApprovalStatus;
  delete app.locals.getRecruiterApprovalStatus;

  try {
    const unconfigured = await request('/api/recruiter/listings', recruiterToken);
    assert.equal(unconfigured.status, 503);
  } finally {
    app.locals.getRecruiterApprovalStatus = resolver;
  }
});
test('actual /api/auth/me endpoint enforces student authorization', async () => {
  const originalExecute = pool.execute;

  // Isolate the test from a local MySQL installation while exercising
  // the actual authentication router and its real route middleware.
  pool.execute = async (sql, values) => {
    const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();

    if (normalizedSql !== 'SELECT id FROM students WHERE id = ? LIMIT 1') {
      throw new Error(`Unexpected SQL in isolated integration test: ${sql}`);
    }

    const requestedId = String(values[0]);
    const rows = requestedId === '42' ? [{ id: 42 }] : [];

    return [rows, []];
  };

  try {
    const unauthenticated = await request('/api/auth/me');
    assert.equal(unauthenticated.status, 401);

    const adminToken = signJwt('admin-1', 'ADMIN');
    const wrongRole = await request('/api/auth/me', adminToken);
    assert.equal(wrongRole.status, 403);

    const studentToken = signJwt('42', 'STUDENT');
    const validStudent = await request('/api/auth/me', studentToken);
    assert.equal(validStudent.status, 200);
    assert.equal(validStudent.body.id, 42);
    assert.equal(validStudent.body.role, 'STUDENT');

    const nonexistentStudentToken = signJwt('999', 'STUDENT');
    const nonexistentStudent = await request(
      '/api/auth/me',
      nonexistentStudentToken
    );
    assert.equal(nonexistentStudent.status, 401);
  } finally {
    pool.execute = originalExecute;
  }
});