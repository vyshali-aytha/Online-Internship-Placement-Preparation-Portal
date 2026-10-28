import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { signJwt, verifyJwt } from '../server/security.js';

const TEST_SECRET = 'local-test-secret-with-at-least-32-chars';
const encoder = (value) => Buffer.from(value).toString('base64url');

function createSignedToken({ header = { alg: 'HS256', typ: 'JWT' }, payload, secret = TEST_SECRET }) {
  const unsigned = `${encoder(JSON.stringify(header))}.${encoder(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function withEnv(values, callback) {
  const original = new Map();
  for (const [name, value] of Object.entries(values)) {
    original.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return callback();
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('bcrypt hashes and verifies dummy passwords', async () => {
  const hash = await bcrypt.hash('DummyOnly12345!', 10);

  assert.notEqual(hash, 'DummyOnly12345!');
  assert.equal(await bcrypt.compare('DummyOnly12345!', hash), true);
  assert.equal(await bcrypt.compare('WrongDummy12345!', hash), false);
});

test('valid JWT contains subject, role, issue time, and expiry claims', () => {
  withEnv({ JWT_SECRET: TEST_SECRET, JWT_EXPIRES_IN: '1h' }, () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signJwt('test-student-id', 'student');
    const after = Math.floor(Date.now() / 1000);
    const payload = verifyJwt(token);

    assert.equal(payload.sub, 'test-student-id');
    assert.equal(payload.role, 'STUDENT');
    assert.equal(payload.exp - payload.iat, 60 * 60);
    assert.ok(payload.iat >= before && payload.iat <= after);
  });
});

test('malformed tokens are rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    for (const token of ['', 'only.two', 'not.a.jwt', 'header.payload.signature.extra']) {
      assert.throws(() => verifyJwt(token), /Invalid authentication token/);
    }
  });
});

test('tampered payload and signature are rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET, JWT_EXPIRES_IN: '1h' }, () => {
    const token = signJwt('test-student-id', 'student');
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

    decodedPayload.sub = 'tampered-student-id';
    const alteredPayload = encoder(JSON.stringify(decodedPayload));
    assert.throws(() => verifyJwt(`${header}.${alteredPayload}.${signature}`), /Invalid authentication token/);

    const alteredSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    assert.throws(() => verifyJwt(`${header}.${payload}.${alteredSignature}`), /Invalid authentication token/);
  });
});

test('expired JWT is rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createSignedToken({
      payload: { sub: 'test-student-id', role: 'student', iat: now - 120, exp: now - 60 },
    });

    assert.throws(() => verifyJwt(token), /expired or invalid/);
  });
});

test('unsupported JWT algorithms are rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createSignedToken({
      header: { alg: 'HS512', typ: 'JWT' },
      payload: { sub: 'test-student-id', role: 'student', iat: now, exp: now + 60 },
    });

    assert.throws(() => verifyJwt(token), /Invalid authentication token/);
  });
});

test('invalid JWT claims are rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    const now = Math.floor(Date.now() / 1000);
    const invalidClaims = [
      { sub: '', role: 'student', iat: now, exp: now + 60 },
      { sub: 'test-student-id', role: 'student', iat: now, exp: 'later' },
      { sub: 'test-student-id', role: 'student', iat: now + 60, exp: now + 120 },
    ];

    for (const payload of invalidClaims) {
      assert.throws(
        () => verifyJwt(createSignedToken({ payload })),
        /expired or invalid/,
      );
    }
  });
});

test('missing JWT_SECRET is rejected', () => {
  withEnv({ JWT_SECRET: undefined, JWT_EXPIRES_IN: '1h' }, () => {
    assert.throws(() => signJwt('test-student-id', 'student'), /JWT_SECRET/);
  });
});

test('too-short JWT_SECRET is rejected', () => {
  withEnv({ JWT_SECRET: 'too-short', JWT_EXPIRES_IN: '1h' }, () => {
    assert.throws(() => signJwt('test-student-id', 'student'), /JWT_SECRET/);
  });
});

test('invalid JWT_EXPIRES_IN configurations are rejected', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    for (const duration of ['0', '-1', 'soon', '1w', ' 1h', 'Infinity', '9007199254740992']) {
      assert.throws(
        () => withEnv({ JWT_EXPIRES_IN: duration }, () => signJwt('test-student-id', 'student')),
        /JWT_EXPIRES_IN/,
      );
    }
  });
});

test('valid JWT_EXPIRES_IN configurations are accepted', () => {
  withEnv({ JWT_SECRET: TEST_SECRET }, () => {
    for (const duration of ['45', '30m', '2h', '1d']) {
      withEnv({ JWT_EXPIRES_IN: duration }, () => {
        const token = signJwt('test-student-id', 'student');
        assert.equal(typeof verifyJwt(token).exp, 'number');
      });
    }
  });
});
