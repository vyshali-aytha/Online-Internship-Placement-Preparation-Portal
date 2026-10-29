const ALLOWED_FIELDS = new Set([
  'actorType', 'actorId', 'role', 'outcome', 'statusCode', 'reason',
]);

/**
 * Emits structured security events without accepting arbitrary request data.
 * Never pass passwords, tokens, emails, request bodies, or raw errors here.
 */
export function logSecurityEvent(event, details = {}, sink = console.warn) {
  if (typeof event !== 'string' || !/^[a-z0-9_.-]{1,80}$/.test(event)) {
    throw new TypeError('Invalid security event identifier.');
  }

  const record = {
    timestamp: new Date().toISOString(),
    type: 'security_event',
    event,
  };

  for (const [key, value] of Object.entries(details)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (typeof value === 'string') {
      record[key] = value.slice(0, 80);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      record[key] = value;
    }
  }

  sink(JSON.stringify(record));
}
