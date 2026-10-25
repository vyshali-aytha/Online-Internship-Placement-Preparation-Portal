import { createHmac, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function parseExpiresIn(value) {
  if (/^\d+$/.test(value)) return Number(value);

  const match = /^([1-9]\d*)([smhd])$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN must be a duration such as 15m, 1h, or 86400.');

  const amount = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return amount * unitSeconds;
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export function signJwt(subject, role = 'student') {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN || '1h');
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ sub: subject, role, iat: now, exp: now + expiresIn }));
  const unsigned = `${header}.${payload}`;
  const signature = base64Url(createHmac('sha256', jwtSecret()).update(unsigned).digest());
  return `${unsigned}.${signature}`;
}

export function verifyJwt(token) {
  if (typeof token !== 'string') throw new Error('Invalid authentication token.');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid authentication token.');

  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid authentication token.');
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Invalid authentication token.');
  }

  const unsigned = `${headerPart}.${payloadPart}`;
  const expected = createHmac('sha256', jwtSecret()).update(unsigned).digest();
  const actual = Buffer.from(signaturePart, 'base64url');
  if (actual.length !== expected.length
    || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid authentication token.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now
    || !Number.isInteger(payload.iat) || payload.iat > now
    || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Authentication token is expired or invalid.');
  }

  return payload;
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    req.auth = verifyJwt(header.slice(7).trim());
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    return next();
  };
}
