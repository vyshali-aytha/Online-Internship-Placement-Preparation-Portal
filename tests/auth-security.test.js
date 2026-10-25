import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { signJwt, verifyJwt } from '../server/security.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

test('student password uses bcrypt and verifies with its salt', async () => {
  const hash = await bcrypt.hash('DummyOnly12345!', 10);
  assert.notEqual(hash, 'DummyOnly12345!');
  assert.equal(await bcrypt.compare('DummyOnly12345!', hash), true);
  assert.equal(await bcrypt.compare('WrongDummy12345!', hash), false);
});

test('JWT includes subject, role, and expiry and rejects tampering', () => {
  const token = signJwt('test-student-id', 'student');
  const payload = verifyJwt(token);
  assert.equal(payload.sub, 'test-student-id');
  assert.equal(payload.role, 'student');
  assert.ok(payload.exp > payload.iat);

  assert.throws(() => verifyJwt(`${token.slice(0, -1)}x`));
  assert.throws(() => verifyJwt('malformed.token'));
});

test('expired JWT is rejected', () => {
  process.env.JWT_EXPIRES_IN = '-1';
  assert.throws(() => signJwt('test-student-id', 'student'), /JWT_EXPIRES_IN/);
  process.env.JWT_EXPIRES_IN = '1h';
});
