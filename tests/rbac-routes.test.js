import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';

import authRouter from '../server/auth.js';
import { pool } from '../server/db.js';
import { signJwt } from '../server/security.js';
import { createRbacRouter } from '../server/rbac-routes.js';
import { createRecruiterApprovalStatusResolver } from '../server/recruiterApproval.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

const recruiterRows = new Map([
  ['17', {
    id: 17,
    full_name: 'Approved Recruiter',
    email: 'approved@example.com',
    company_name: 'Acme',
    status: 'APPROVED',
    password_hash: '',
    created_at: '2026-10-25 00:00:00',
    reviewed_at: null,
    reviewed_by: null,
  }],
  ['18', {
    id: 18,
    full_name: 'Pending Recruiter',
    email: 'pending@example.com',
    company_name: 'Example Ltd',
    status: 'PENDING',
    password_hash: '',
    created_at: '2026-10-25 00:00:00',
    reviewed_at: null,
    reviewed_by: null,
  }],
  ['19', {
    id: 19,
    full_name: 'Rejected Recruiter',
    email: 'rejected@example.com',
    company_name: 'Rejected Ltd',
    status: 'REJECTED',
    password_hash: '',
    created_at: '2026-10-25 00:00:00',
    reviewed_at: null,
    reviewed_by: null,
  }],
]);

const fakePool = {
  async execute(sql, values = []) {
    const normalized = String(sql)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    if (
      normalized.includes(
        'SELECT STATUS FROM RECRUITER_REQUESTS WHERE ID = ? LIMIT 1'
      )
    ) {
      const row = recruiterRows.get(String(values[0]));

      return [
        row ? [{ status: row.status }] : [],
        [],
      ];
    }

    if (
      normalized.includes(
        'FROM RECRUITER_REQUESTS WHERE STATUS = \'PENDING\' ORDER BY CREATED_AT ASC'
          .toUpperCase()
      )
    ) {
      const pending = [...recruiterRows.values()]
        .filter((row) => row.status === 'PENDING')
        .map((row) => ({
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          company_name: row.company_name,
          status: row.status,
          created_at: row.created_at,
          reviewed_at: row.reviewed_at,
          reviewed_by: row.reviewed_by,
        }));

      return [pending, []];
    }

    throw new Error(`Unexpected SQL in test database: ${sql}`);
  },
};

const app = express();
app.use(express.json());

app.locals.getRecruiterApprovalStatus =
  createRecruiterApprovalStatusResolver(fakePool);

app.use('/api/auth', authRouter);
app.use('/api', createRbacRouter(fakePool));

app.use((error, _req, res, _next) => {
  return res.status(500).json({ message: 'Unexpected test server error.' });
});

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

async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const headers = {};

  if (token) headers.authorization = `Bearer ${token}`;

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test('recruiter login requires approval and access rechecks live database status', async () => {
  const approvedHash = await bcrypt.hash('RecruiterPass123!', 10);
  const pendingHash = await bcrypt.hash('PendingPass123!', 10);

  recruiterRows.get('17').password_hash = approvedHash;
  recruiterRows.get('18').password_hash = pendingHash;

  const originalExecute = pool.execute;

  pool.execute = async (sql, values = []) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (
      normalized.includes(
        'SELECT ID, PASSWORD_HASH, STATUS FROM RECRUITER_REQUESTS WHERE EMAIL = ? LIMIT 1'
      )
    ) {
      const email = String(values[0]).toLowerCase();

      const recruiter = [...recruiterRows.values()]
        .find((row) => row.email === email);

      return [
        recruiter
          ? [{
              id: recruiter.id,
              password_hash: recruiter.password_hash,
              status: recruiter.status,
            }]
          : [],
        [],
      ];
    }

    return originalExecute.call(pool, sql, values);
  };

  try {
    const approvedLogin = await apiRequest('/api/auth/recruiter/login', {
      method: 'POST',
      body: {
        email: 'approved@example.com',
        password: 'RecruiterPass123!',
      },
    });

    assert.equal(approvedLogin.status, 200);
    assert.equal(typeof approvedLogin.body.token, 'string');

    const access = await apiRequest('/api/recruiter/access', {
      token: approvedLogin.body.token,
    });

    assert.equal(access.status, 200);
    assert.equal(access.body.id, '17');
    assert.equal(access.body.role, 'RECRUITER');
    assert.equal(access.body.approved, true);

    // A previously issued token must stop working after revocation.
    recruiterRows.get('17').status = 'REJECTED';

    const revoked = await apiRequest('/api/recruiter/access', {
      token: approvedLogin.body.token,
    });

    assert.equal(revoked.status, 403);

    recruiterRows.get('17').status = 'APPROVED';

    const pendingLogin = await apiRequest('/api/auth/recruiter/login', {
      method: 'POST',
      body: {
        email: 'pending@example.com',
        password: 'PendingPass123!',
      },
    });

    assert.equal(pendingLogin.status, 403);
    assert.equal(pendingLogin.body.token, undefined);

    const wrongPassword = await apiRequest('/api/auth/recruiter/login', {
      method: 'POST',
      body: {
        email: 'approved@example.com',
        password: 'WrongPassword123!',
      },
    });

    assert.equal(wrongPassword.status, 401);
  } finally {
    pool.execute = originalExecute;
  }
});

test('recruiter access endpoint rejects unauthenticated and wrong-role requests', async () => {
  const unauthenticated = await apiRequest('/api/recruiter/access');
  assert.equal(unauthenticated.status, 401);

  const student = await apiRequest('/api/recruiter/access', {
    token: signJwt('42', 'STUDENT'),
  });

  assert.equal(student.status, 403);

  const pendingRecruiter = await apiRequest('/api/recruiter/access', {
    token: signJwt('18', 'RECRUITER'),
  });

  assert.equal(pendingRecruiter.status, 403);
});

test('admin pending-request endpoint is protected and excludes password hashes', async () => {
  const unauthenticated = await apiRequest('/api/admin/recruiter-requests');
  assert.equal(unauthenticated.status, 401);

  const student = await apiRequest('/api/admin/recruiter-requests', {
    token: signJwt('42', 'STUDENT'),
  });

  assert.equal(student.status, 403);

  const admin = await apiRequest('/api/admin/recruiter-requests', {
    token: signJwt('1', 'ADMIN'),
  });

  assert.equal(admin.status, 200);
  assert.ok(Array.isArray(admin.body));
  assert.ok(admin.body.every((row) => row.status === 'PENDING'));

  assert.equal(
    JSON.stringify(admin.body).includes('password_hash'),
    false
  );
});