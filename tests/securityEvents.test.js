import test from 'node:test';
import assert from 'node:assert/strict';
import { logSecurityEvent } from '../server/securityEvents.js';

test('security events contain a timestamp and identifiable event', () => {
  const output = [];
  logSecurityEvent('auth.student.login.failure', {
    actorType: 'student',
    outcome: 'invalid_credentials',
    statusCode: 401,
  }, line => output.push(line));

  assert.equal(output.length, 1);
  const record = JSON.parse(output[0]);
  assert.equal(record.event, 'auth.student.login.failure');
  assert.equal(record.type, 'security_event');
  assert.equal(record.statusCode, 401);
  assert.ok(!Number.isNaN(Date.parse(record.timestamp)));
});

test('security logger excludes passwords, tokens, emails, and arbitrary fields', () => {
  const output = [];
  logSecurityEvent('auth.admin.login.failure', {
    outcome: 'invalid_credentials',
    password: 'do-not-log-password',
    token: 'do-not-log-token',
    email: 'private@example.com',
    requestBody: 'sensitive',
  }, line => output.push(line));

  assert.equal(output.length, 1);
  for (const secret of ['do-not-log-password', 'do-not-log-token', 'private@example.com', 'sensitive']) {
    assert.equal(output[0].includes(secret), false);
  }
});

test('invalid security event identifiers are rejected', () => {
  assert.throws(() => logSecurityEvent('invalid event name'), TypeError);
});
