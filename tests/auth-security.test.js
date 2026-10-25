import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import {
  signJwt,
  verifyJwt,
  requireRoles,
  requireApprovedRecruiter,
} from '../server/security.js';

process.env.JWT_SECRET = 'local-test-secret-with-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';

function invokeMiddleware(middleware, auth) {
  const req = {};

  if (auth !== undefined) {
    req.auth = auth;
  }

  const res = {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    },
  };

  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
}

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

test('expired JWT configuration is rejected', () => {
  process.env.JWT_EXPIRES_IN = '-1';

  assert.throws(
    () => signJwt('test-student-id', 'student'),
    /JWT_EXPIRES_IN/
  );

  process.env.JWT_EXPIRES_IN = '1h';
});

test('RBAC allows a user whose role matches the route', () => {
  const cases = [
    ['student', 'STUDENT'],
    ['RECRUITER', 'RECRUITER'],
    ['admin', 'ADMIN'],
  ];

  for (const [userRole, allowedRole] of cases) {
    const result = invokeMiddleware(
      requireRoles(allowedRole),
      { sub: 'user-1', role: userRole }
    );

    assert.equal(result.nextCalled, true, `${userRole} should be allowed`);
    assert.equal(result.res.statusCode, null);
  }
});

test('RBAC denies access when a user has the wrong role', () => {
  const cases = [
    ['student', 'RECRUITER'],
    ['student', 'ADMIN'],
    ['recruiter', 'STUDENT'],
    ['recruiter', 'ADMIN'],
    ['admin', 'STUDENT'],
    ['admin', 'RECRUITER'],
  ];

  for (const [userRole, allowedRole] of cases) {
    const result = invokeMiddleware(
      requireRoles(allowedRole),
      { sub: 'user-1', role: userRole }
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  }
});

test('RBAC denies requests without an authenticated user', () => {
  const result = invokeMiddleware(requireRoles('STUDENT'), undefined);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test('RBAC rejects an invalid role configuration', () => {
  assert.throws(
    () => requireRoles('SUPERUSER'),
    /valid roles/
  );

  assert.throws(
    () => requireRoles(),
    /valid roles/
  );
});

test('only approved recruiters pass the approval middleware', () => {
  for (const status of [undefined, 'PENDING', 'REJECTED']) {
    const auth = { sub: 'recruiter-1', role: 'RECRUITER' };

    if (status !== undefined) {
      auth.recruiterStatus = status;
    }

    const result = invokeMiddleware(requireApprovedRecruiter, auth);

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  }

  const approved = invokeMiddleware(
    requireApprovedRecruiter,
    {
      sub: 'recruiter-2',
      role: 'recruiter',
      recruiterStatus: 'APPROVED',
    }
  );

  assert.equal(approved.nextCalled, true);
  assert.equal(approved.res.statusCode, null);
});

test('approval status does not grant recruiter access to another role', () => {
  const result = invokeMiddleware(
    requireApprovedRecruiter,
    {
      sub: 'student-1',
      role: 'STUDENT',
      recruiterStatus: 'APPROVED',
    }
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 403);
});

test('approval middleware requires authentication', () => {
  const result = invokeMiddleware(requireApprovedRecruiter, undefined);

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});