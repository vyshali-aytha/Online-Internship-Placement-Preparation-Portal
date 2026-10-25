const bcrypt = require('bcrypt');
const db = require('../config/db');

async function createRequest({ fullName, email, companyName, password }) {
  const hash = await bcrypt.hash(password, 10);
  // Status is always PENDING; the client can never choose it.
  const [result] = await db.execute(
    `INSERT INTO recruiter_requests (full_name, email, company_name, password_hash, status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [fullName, email, companyName, hash]
  );
  return { id: result.insertId, email, status: 'PENDING' };
}

async function listPending() {
  const [rows] = await db.execute(
    `SELECT id, full_name, email, company_name, status, created_at
     FROM recruiter_requests WHERE status = 'PENDING' ORDER BY created_at`
  );
  return rows;
}

module.exports = { createRequest, listPending };
