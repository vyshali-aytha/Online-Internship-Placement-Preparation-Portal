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

async function invokeMiddleware(middleware, auth, resolver) {
  const req = {
    app: { locals: {} },
    headers: {},
  };

  if (auth !== undefined) req.auth = auth;

  if (resolver) {
    req.app.locals.getRecruiterApprovalStatus = resolver;
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

  await middleware(req, res, () => {
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

test('JWT normalizes roles and rejects tampering', () => {
  const token = signJwt('test-student-id', 'student');
  const payload = verifyJwt(token);

  assert.equal(payload.sub, 'test-student-id');
  assert.equal(payload.role, 'STUDENT');
  assert.ok(payload.exp > payload.iat);

  assert.throws(() => signJwt('test-user', 'SUPERUSER'));
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  const replacementFirstChar = signaturePart[0] === 'A' ? 'B' : 'A';
  const tamperedSignature = `${replacementFirstChar}${signaturePart.slice(1)}`;
  assert.throws(() => verifyJwt(`${headerPart}.${payloadPart}.${tamperedSignature}`));
  assert.throws(() => verifyJwt('malformed.token'));
});

test('invalid JWT expiration configuration is rejected', () => {
  process.env.JWT_EXPIRES_IN = '-1';

  assert.throws(
    () => signJwt('test-student-id', 'student'),
    /JWT_EXPIRES_IN/
  );

  process.env.JWT_EXPIRES_IN = '1h';
});

test('matching student, recruiter, and admin roles are allowed', async () => {
  for (const role of ['STUDENT', 'RECRUITER', 'ADMIN']) {
    const result = await invokeMiddleware(
      requireRoles(role),
      { sub: 'user-1', role: role.toLowerCase() }
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.res.statusCode, null);
  }
});

test('cross-role access is forbidden', async () => {
  const cases = [
    ['STUDENT', 'RECRUITER'],
    ['STUDENT', 'ADMIN'],
    ['RECRUITER', 'STUDENT'],
    ['RECRUITER', 'ADMIN'],
    ['ADMIN', 'STUDENT'],
    ['ADMIN', 'RECRUITER'],
  ];

  for (const [allowedRole, userRole] of cases) {
    const result = await invokeMiddleware(
      requireRoles(allowedRole),
      { sub: 'user-1', role: userRole }
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  }
});

test('role middleware denies requests without authentication', async () => {
  const result = await invokeMiddleware(
    requireRoles('STUDENT'),
    undefined
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
});

test('role middleware rejects invalid configuration', () => {
  assert.throws(() => requireRoles('SUPERUSER'), /valid roles/);
  assert.throws(() => requireRoles(), /valid roles/);
});

test('recruiter approval middleware fails closed without a verifier', async () => {
  const result = await invokeMiddleware(
    requireApprovedRecruiter,
    { sub: 'recruiter-1', role: 'RECRUITER' }
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 503);
});

test('recruiter approval is based on the current verifier result', async () => {
  const tokenClaims = {
    sub: 'recruiter-1',
    role: 'RECRUITER',
    recruiterStatus: 'APPROVED',
  };

  for (const status of ['PENDING', 'REJECTED', undefined]) {
    const result = await invokeMiddleware(
      requireApprovedRecruiter,
      tokenClaims,
      async () => status
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  }

  const approved = await invokeMiddleware(
    requireApprovedRecruiter,
    tokenClaims,
    async () => 'APPROVED'
  );

  assert.equal(approved.nextCalled, true);
  assert.equal(approved.res.statusCode, null);
});

test('students and admins cannot use recruiter-only middleware', async () => {
  for (const role of ['STUDENT', 'ADMIN']) {
    const result = await invokeMiddleware(
      requireApprovedRecruiter,
      { sub: 'user-1', role },
      async () => 'APPROVED'
    );

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
  }
});
