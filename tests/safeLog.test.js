import test from 'node:test';
import assert from 'node:assert/strict';

import { redactSensitive, logError } from '../server/safeLog.js';

const hash = '$2a$12$' + 'a'.repeat(53);

test('email addresses are removed from log text', () => {
  const text = redactSensitive("Duplicate entry 'student@stu.pes.edu' for key 'uq_students_email'");
  assert.equal(text.includes('student@stu.pes.edu'), false);
  assert.ok(text.includes('[email]'));
});

test('password hashes, JWTs and bearer tokens are removed from log text', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
  assert.equal(redactSensitive(`hash ${hash}`).includes(hash), false);
  assert.equal(redactSensitive(`token ${jwt}`).includes(jwt), false);
  assert.equal(redactSensitive(`Authorization: Bearer ${jwt}`).includes(jwt), false);
});

test('password and OTP values in key=value text are removed', () => {
  const text = redactSensitive('password=Secret123! otp: 482913 {"password":"Hunter2hunter2"}');
  assert.equal(text.includes('Secret123!'), false);
  assert.equal(text.includes('482913'), false);
  assert.equal(text.includes('Hunter2hunter2'), false);
});

test('logError records the type, code and a redacted message only', () => {
  const lines = [];
  const error = Object.assign(
    new Error("Duplicate entry 'a@b.com' for key 'email'"),
    { code: 'ER_DUP_ENTRY', sql: 'INSERT ... VALUES (?)', params: ['a@b.com', hash] }
  );

  logError('Unhandled error', error, (line) => lines.push(line));

  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith('Unhandled error: Error ER_DUP_ENTRY'));
  assert.equal(lines[0].includes('a@b.com'), false);
  assert.equal(lines[0].includes(hash), false);
  assert.equal(lines[0].includes('INSERT'), false);
});

test('ordinary text without sensitive data is left unchanged', () => {
  assert.equal(redactSensitive('Could not connect to MySQL'), 'Could not connect to MySQL');
  assert.equal(redactSensitive(undefined), '');
});
