import { createHmac, timingSafeEqual } from 'node:crypto';

const VALID_ROLES = new Set(['STUDENT', 'RECRUITER', 'ADMIN']);

function normalizeRole(role) {
  if (typeof role !== 'string') return null;

  const normalized = role.trim().toUpperCase();
  return VALID_ROLES.has(normalized) ? normalized : null;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function parseExpiresIn(value) {
  if (/^\d+$/.test(value)) return Number(value);

  const match = /^([1-9]\d*)([smhd])$/.exec(value);

  if (!match) {
    throw new Error(
      'JWT_EXPIRES_IN must be a duration such as 15m, 1h, or 86400.'
    );
  }

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

export function signJwt(subject, role = 'STUDENT') {
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new Error('JWT subject must be a non-empty string.');
  }

  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    throw new Error('JWT role must be STUDENT, RECRUITER, or ADMIN.');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseExpiresIn(process.env.JWT_EXPIRES_IN || '1h');

  const header = base64Url(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
  }));

  const payload = base64Url(JSON.stringify({
    sub: subject,
    role: normalizedRole,
    iat: now,
    exp: now + expiresIn,
  }));

  const unsigned = `${header}.${payload}`;

  const signature = base64Url(
    createHmac('sha256', jwtSecret()).update(unsigned).digest()
  );

  return `${unsigned}.${signature}`;
}

export function verifyJwt(token) {
  if (typeof token !== 'string') {
    throw new Error('Invalid authentication token.');
  }

  const parts = token.split('.');

  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error('Invalid authentication token.');
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  let header;
  let payload;

  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid authentication token.');
  }

  if (
    !header ||
    typeof header !== 'object' ||
    Array.isArray(header) ||
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    header.alg !== 'HS256' ||
    header.typ !== 'JWT'
  ) {
    throw new Error('Invalid authentication token.');
  }

  const unsigned = `${headerPart}.${payloadPart}`;

  const expected = createHmac('sha256', jwtSecret())
    .update(unsigned)
    .digest();

  const actual = Buffer.from(signaturePart, 'base64url');

  if (
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    throw new Error('Invalid authentication token.');
  }

  const now = Math.floor(Date.now() / 1000);
  const role = normalizeRole(payload.role);

  if (
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    !Number.isInteger(payload.iat) ||
    payload.iat > now ||
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    !role
  ) {
    throw new Error('Authentication token is expired or invalid.');
  }

  return { ...payload, role };
}

export function requireAuth(req, res, next) {
  const header =
    typeof req.get === 'function'
      ? req.get('authorization')
      : req.headers?.authorization;

  const match =
    typeof header === 'string'
      ? /^Bearer\s+(.+)$/i.exec(header)
      : null;

  if (!match || !match[1].trim()) {
    return res.status(401).json({
      message: 'Authentication required.',
    });
  }

  try {
    req.auth = verifyJwt(match[1].trim());
    return next();
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired authentication token.',
    });
  }
}

export function requireRoles(...roles) {
  const allowedRoles = roles.map(normalizeRole);

  if (
    roles.length === 0 ||
    allowedRoles.some((role) => role === null)
  ) {
    throw new TypeError(
      'requireRoles needs valid roles: STUDENT, RECRUITER, ADMIN.'
    );
  }

  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({
        message: 'Authentication required.',
      });
    }

    const role = normalizeRole(req.auth.role);

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        message: 'Forbidden: insufficient permissions.',
      });
    }

    return next();
  };
}

/**
 * Recruiter approval must be checked against the application's
 * authoritative data source, not a potentially stale JWT claim.
 *
 * A recruiter route must configure:
 * app.locals.getRecruiterApprovalStatus = async (recruiterId) => ...
 *
 * The returned status must represent the current database status.
 */
export async function requireApprovedRecruiter(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({
      message: 'Authentication required.',
    });
  }

  if (normalizeRole(req.auth.role) !== 'RECRUITER') {
    return res.status(403).json({
      message: 'Forbidden: recruiter access required.',
    });
  }

  const getApprovalStatus =
    req.app?.locals?.getRecruiterApprovalStatus;

  if (typeof getApprovalStatus !== 'function') {
    return res.status(503).json({
      message: 'Recruiter approval verification is not configured.',
    });
  }

  try {
    const status = await getApprovalStatus(req.auth.sub);

    if (
      typeof status !== 'string' ||
      status.trim().toUpperCase() !== 'APPROVED'
    ) {
      return res.status(403).json({
        message: 'Recruiter account must be approved for this operation.',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}