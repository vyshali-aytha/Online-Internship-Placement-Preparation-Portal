import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

import { signJwt } from '../server/security.js';
import { createRbacRouter } from '../server/rbac-routes.js';

const students = [
  { id: 1, course: 'CSE' },
  { id: 2, course: 'CSE' },
  { id: 3, course: 'ECE' },
  { id: 4, course: 'EEE' },
];

const applications = [
  { id: 11, student_id: 1, listing_id: 1, status: 'Applied', applied_at: '2026-02-01 08:00:00' },
  { id: 12, student_id: 1, listing_id: 1, status: 'Selected', applied_at: '2026-02-05 09:00:00' },
  { id: 13, student_id: 2, listing_id: 1, status: 'Selected', applied_at: '2026-02-18 12:00:00' },
  { id: 14, student_id: 3, listing_id: 2, status: 'Rejected', applied_at: '2026-02-20 18:00:00' },
  { id: 15, student_id: 4, listing_id: 2, status: 'Selected', applied_at: '2026-03-09 10:00:00' },
];

const fakePool = {
  async execute(sql, values = []) {
    const query = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (query.startsWith('SELECT COUNT(*) AS TOTAL_APPLICATIONS')) {
      const branchValue = values.find((value) => typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value));
      const dateValues = values.filter((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
      const startDate = dateValues[0] || null;
      const endDate = dateValues[dateValues.length - 1] || null;

      const filtered = applications.filter((application) => {
        const student = students.find((entry) => entry.id === application.student_id);
        if (!student) return false;
        if (branchValue && student.course.toLowerCase() !== String(branchValue).toLowerCase()) {
          return false;
        }
        const appliedAt = new Date(`${application.applied_at.replace(' ', 'T')}Z`);
        if (startDate) {
          const start = new Date(`${startDate}T00:00:00Z`);
          if (appliedAt < start) return false;
        }
        if (endDate) {
          const end = new Date(`${endDate}T23:59:59Z`);
          if (appliedAt > end) return false;
        }
        return true;
      });

      return [[{
        total_applications: filtered.length,
        total_offers: filtered.filter((application) => application.status === 'Selected').length,
      }], []];
    }

    if (query.startsWith('SELECT DISTINCT TRIM(COURSE) AS BRANCH')) {
      const branches = Array.from(
        new Set(
          students
            .map((student) => student.course)
            .filter((course) => typeof course === 'string' && course.trim() !== '')
            .map((course) => course.trim())
        )
      ).sort((left, right) => left.localeCompare(right));

      return [[branches.map((branch) => ({ branch }))], []];
    }

    throw new Error(`Unexpected SQL in test database: ${sql}`);
  },
};

const app = express();
app.use(express.json());
app.use('/api', createRbacRouter(fakePool));
app.use((_error, _req, res, _next) => {
  res.status(500).json({ message: 'Unexpected test server error.' });
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
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

async function api(path, { token, method = 'GET' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
  });
  const raw = await response.text();
  return { status: response.status, body: raw ? JSON.parse(raw) : null, raw };
}

test('admin placement summary requires admin authentication', async () => {
  assert.equal((await api('/api/admin/placement-summary')).status, 401);
  assert.equal((await api('/api/admin/placement-summary', { token: signJwt('42', 'STUDENT') })).status, 403);
});

test('admin placement summary calculates totals and selection rate for all branches', async () => {
  const res = await api('/api/admin/placement-summary', {
    token: signJwt('admin:admin@oipp.local', 'ADMIN'),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.totalApplications, 5);
  assert.equal(res.body.totalOffers, 3);
  assert.equal(res.body.selectionRate, 60);
  assert.equal(res.body.branch, 'All Branches');
  assert.equal(res.body.note.includes('Selected'), true);
});

test('admin placement summary honors branch and inclusive date filters', async () => {
  const res = await api('/api/admin/placement-summary?branch=CSE&startDate=2026-02-01&endDate=2026-02-28', {
    token: signJwt('admin:admin@oipp.local', 'ADMIN'),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.totalApplications, 3);
  assert.equal(res.body.totalOffers, 2);
  assert.equal(res.body.selectionRate, 66.67);
  assert.equal(res.body.branch, 'CSE');
  assert.equal(res.body.startDate, '2026-02-01');
  assert.equal(res.body.endDate, '2026-02-28');
});

test('admin placement summary rejects invalid dates', async () => {
  const res = await api('/api/admin/placement-summary?startDate=invalid&endDate=2026-02-20', {
    token: signJwt('admin:admin@oipp.local', 'ADMIN'),
  });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /valid YYYY-MM-DD/i);
});
