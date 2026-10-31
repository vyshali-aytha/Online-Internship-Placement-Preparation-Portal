import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { signJwt } from '../server/security.js';
import { createRecruiterApplicantsRouter } from '../server/recruiter-applicants.js';
import { createRecruiterApprovalStatusResolver } from '../server/recruiterApproval.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

// recruiter 17 and 19 are approved, 18 is pending
const recruiterStatus = { 17: 'APPROVED', 18: 'PENDING', 19: 'APPROVED' };

// listing 1 belongs to recruiter 17, listing 2 to recruiter 19
const listings = [
  { id: 1, recruiter_id: 17, title: 'Backend Intern' },
  { id: 2, recruiter_id: 19, title: 'Data Analyst' },
];

const snapshot = (name) => ({
  full_name: name,
  institutional_email: `${name.toLowerCase().replace(' ', '.')}@stu.pes.edu`,
  student_id: `S-${name.length}`,
  course: 'CSE',
  phone: '9999999999',
  location: 'Bengaluru',
  headline: 'Aspiring engineer',
  bio: 'Private bio text',
  cgpa: '8.40',
  skills: 'Node, SQL',
  projects: 'Portal',
});

let applications;

function resetApplications() {
  applications = [
    { id: 10, listing_id: 1, status: 'Applied', applied_at: '2026-10-30 10:00:00', updated_at: '2026-10-30 10:00:00', resume_name: 'asha.pdf', profile_snapshot: snapshot('Asha Rao'), resume_data: Buffer.from('SECRET-RESUME') },
    { id: 11, listing_id: 1, status: 'Interview', applied_at: '2026-10-30 11:00:00', updated_at: '2026-10-30 11:00:00', resume_name: 'ben.pdf', profile_snapshot: JSON.stringify(snapshot('Ben Das')), resume_data: Buffer.from('SECRET-RESUME') },
    { id: 20, listing_id: 2, status: 'Applied', applied_at: '2026-10-30 12:00:00', updated_at: '2026-10-30 12:00:00', resume_name: 'chen.pdf', profile_snapshot: snapshot('Chen Li'), resume_data: Buffer.from('SECRET-RESUME') },
  ];
}
resetApplications();

const fakePool = {
  async execute(sql, values = []) {
    const q = String(sql).replace(/\s+/g, ' ').trim().toUpperCase();

    if (q.startsWith('SELECT STATUS FROM RECRUITER_REQUESTS WHERE ID = ?')) {
      const status = recruiterStatus[values[0]];
      return [status ? [{ status }] : [], []];
    }

    if (q.startsWith('SELECT ID, TITLE FROM INTERNSHIP_LISTINGS WHERE ID = ? AND RECRUITER_ID = ?')) {
      const row = listings.find((l) => l.id === values[0] && l.recruiter_id === values[1]);
      return [row ? [{ id: row.id, title: row.title }] : [], []];
    }

    if (q.startsWith('SELECT A.ID, A.STATUS, A.APPLIED_AT')) {
      assert.equal(q.includes('RESUME_DATA'), false, 'applicant list must not select the resume file');
      const rows = applications.filter((a) => {
        const l = listings.find((x) => x.id === a.listing_id);
        return a.listing_id === values[0] && l.recruiter_id === values[1];
      });
      return [rows, []];
    }

    if (q.startsWith('SELECT A.ID, A.STATUS FROM APPLICATIONS A JOIN')) {
      const row = applications.find((a) => {
        const l = listings.find((x) => x.id === a.listing_id);
        return a.id === values[0] && l.recruiter_id === values[1];
      });
      return [row ? [{ id: row.id, status: row.status }] : [], []];
    }

    if (q.startsWith('UPDATE APPLICATIONS SET STATUS = ? WHERE ID = ? AND STATUS = ?')) {
      const row = applications.find((a) => a.id === values[1] && a.status === values[2]);
      if (row) row.status = values[0];
      return [{ affectedRows: row ? 1 : 0 }, []];
    }

    throw new Error(`Unexpected SQL in test database: ${sql}`);
  },
};

const app = express();
app.use(express.json());
app.locals.getRecruiterApprovalStatus = createRecruiterApprovalStatusResolver(fakePool);
app.use('/api', createRecruiterApplicantsRouter(fakePool));
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
  return { status: response.status, body: raw ? JSON.parse(raw) : null, raw };
}

const rec17 = () => signJwt('17', 'RECRUITER');
const rec19 = () => signJwt('19', 'RECRUITER');
const rec18 = () => signJwt('18', 'RECRUITER');

test('a recruiter can view the applicants for their own listing', async () => {
  resetApplications();
  const res = await api('/api/recruiter/listings/1/applicants', { token: rec17() });
  assert.equal(res.status, 200);
  assert.equal(res.body.listing.title, 'Backend Intern');
  assert.equal(res.body.applicants.length, 2);

  const first = res.body.applicants[0];
  assert.equal(first.applicationId, 10);
  assert.equal(first.status, 'Applied');
  assert.equal(first.student.fullName, 'Asha Rao');
  assert.equal(first.student.cgpa, '8.40');
  // snapshots stored as a JSON string work too
  assert.equal(res.body.applicants[1].student.fullName, 'Ben Das');
});

test('applicant data excludes phone, bio and the resume file contents', async () => {
  const res = await api('/api/recruiter/listings/1/applicants', { token: rec17() });
  assert.equal(res.raw.includes('9999999999'), false);
  assert.equal(res.raw.includes('Private bio text'), false);
  assert.equal(res.raw.includes('SECRET-RESUME'), false);
  assert.equal(res.raw.includes('resume_data'), false);
});

test("a recruiter cannot view applicants for another recruiter's listing", async () => {
  const res = await api('/api/recruiter/listings/2/applicants', { token: rec17() });
  assert.equal(res.status, 404);
  assert.equal(res.raw.includes('Chen'), false);
});

test('unapproved recruiters, students and anonymous users are refused', async () => {
  assert.equal((await api('/api/recruiter/listings/1/applicants', { token: rec18() })).status, 403);
  assert.equal((await api('/api/recruiter/listings/1/applicants', { token: signJwt('42', 'STUDENT') })).status, 403);
  assert.equal((await api('/api/recruiter/listings/1/applicants')).status, 401);
  assert.equal((await api('/api/recruiter/applications/10/status', { method: 'PATCH', body: { status: 'Shortlisted' } })).status, 401);
});

test('a recruiter can mark an applicant as shortlisted or rejected', async () => {
  resetApplications();
  const shortlisted = await api('/api/recruiter/applications/10/status', {
    token: rec17(), method: 'PATCH', body: { status: 'Shortlisted' },
  });
  assert.equal(shortlisted.status, 200);
  assert.equal(applications.find((a) => a.id === 10).status, 'Shortlisted');

  const rejected = await api('/api/recruiter/applications/10/status', {
    token: rec17(), method: 'PATCH', body: { status: 'Rejected' },
  });
  assert.equal(rejected.status, 200);
  assert.equal(applications.find((a) => a.id === 10).status, 'Rejected');
});

test("a recruiter cannot change an application on another recruiter's listing", async () => {
  resetApplications();
  const res = await api('/api/recruiter/applications/20/status', {
    token: rec17(), method: 'PATCH', body: { status: 'Rejected' },
  });
  assert.equal(res.status, 404);
  assert.equal(applications.find((a) => a.id === 20).status, 'Applied');
});

test('only Shortlisted and Rejected are accepted as decisions', async () => {
  resetApplications();
  for (const status of ['Selected', 'Interview', 'Applied', 'approved', '', undefined, 5]) {
    const res = await api('/api/recruiter/applications/10/status', {
      token: rec17(), method: 'PATCH', body: { status },
    });
    assert.equal(res.status, 400, String(status));
  }
  assert.equal((await api('/api/recruiter/applications/abc/status', { token: rec17(), method: 'PATCH', body: { status: 'Rejected' } })).status, 400);
  assert.equal(applications.find((a) => a.id === 10).status, 'Applied');
});

test('applications already at Interview or Selected are not overwritten', async () => {
  resetApplications();
  const res = await api('/api/recruiter/applications/11/status', {
    token: rec17(), method: 'PATCH', body: { status: 'Rejected' },
  });
  assert.equal(res.status, 409);
  assert.equal(applications.find((a) => a.id === 11).status, 'Interview');
});
