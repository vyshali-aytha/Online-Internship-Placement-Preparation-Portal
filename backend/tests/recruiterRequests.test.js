process.env.NODE_ENV = 'test';

// In-memory fake database so tests run without MySQL.
const rows = [];
jest.mock('../src/config/db', () => ({
  execute: jest.fn(async (sql, params) => {
    if (sql.includes('INSERT')) {
      const [full_name, email, company_name, password_hash] = params;
      if (rows.some(r => r.email === email)) {
        const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e;
      }
      const row = { id: rows.length + 1, full_name, email, company_name, password_hash, status: 'PENDING' };
      rows.push(row);
      return [{ insertId: row.id }];
    }
    return [rows.filter(r => r.status === 'PENDING')];
  }),
}));

const request = require('supertest');
const app = require('../src/app');

const valid = { fullName: 'Test Recruiter', email: 'r@test.com', companyName: 'Acme', password: 'password123' };

test('recruiter can submit an account request (201)', async () => {
  const res = await request(app).post('/api/recruiter-requests').send(valid);
  expect(res.status).toBe(201);
});

test('new request has PENDING status, even if client sends APPROVED', async () => {
  const res = await request(app)
    .post('/api/recruiter-requests')
    .send({ ...valid, email: 'x@test.com', status: 'APPROVED' });
  expect(res.body.status).toBe('PENDING');
});

test('request appears in admin pending list', async () => {
  const res = await request(app).get('/api/admin/recruiter-requests');
  expect(res.status).toBe(200);
  expect(res.body.some(r => r.email === 'r@test.com')).toBe(true);
});

test('duplicate email returns 409', async () => {
  const res = await request(app).post('/api/recruiter-requests').send(valid);
  expect(res.status).toBe(409);
});

test('invalid input returns 400', async () => {
  const res = await request(app).post('/api/recruiter-requests').send({ email: 'bad' });
  expect(res.status).toBe(400);
});

test('pending request does not create a login or recruiter privileges', async () => {
  // F-020 only stores the request. No users row or token is created here.
  const res = await request(app)
    .post('/api/recruiter-requests')
    .send({ ...valid, email: 'y@test.com' });
  expect(res.body.token).toBeUndefined();
  expect(res.body.role).toBeUndefined();
});
