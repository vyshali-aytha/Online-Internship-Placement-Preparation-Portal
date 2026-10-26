// OIPP-NF-003: keep sensitive data out of application logs.
// Database and library errors can carry personal data in their message
// (for example "Duplicate entry 'someone@stu.pes.edu' for key ..."), so errors
// are logged through redactSensitive() instead of being printed raw.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const BCRYPT_HASH = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;
const SECRET_PAIR = /\b(password|passwd|pwd|secret|token|otp)\b(["']?\s*[:=]\s*)(["']?)[^\s"',;)}]+/gi;

export function redactSensitive(value) {
  return String(value ?? '')
    .replace(BCRYPT_HASH, '[hash]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(SECRET_PAIR, '$1$2$3[redacted]')
    .replace(EMAIL, '[email]');
}

/** Logs an error without personal data: type, code and a redacted message only. */
export function logError(context, error, sink = console.error) {
  const name = error?.name || 'Error';
  const code = error?.code ? ` ${error.code}` : '';
  const message = redactSensitive(error?.message);
  sink(`${context}: ${name}${code}${message ? ` - ${message}` : ''}`);
}
