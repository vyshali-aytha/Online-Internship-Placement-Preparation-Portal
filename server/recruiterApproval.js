/**
 * Creates a live recruiter approval-status resolver.
 * The JWT subject must be the recruiter_requests primary key.
 */
export function createRecruiterApprovalStatusResolver(dbPool) {
  if (!dbPool || typeof dbPool.execute !== 'function') {
    throw new TypeError('A database pool with execute() is required.');
  }

  return async function getRecruiterApprovalStatus(subject) {
    if (
      typeof subject !== 'string' ||
      !/^[1-9]\d*$/.test(subject)
    ) {
      return null;
    }

    const id = Number(subject);

    if (!Number.isSafeInteger(id)) {
      return null;
    }

    const [rows] = await dbPool.execute(
      'SELECT status FROM recruiter_requests WHERE id = ? LIMIT 1',
      [id]
    );

    const status = rows?.[0]?.status;

    return typeof status === 'string'
      ? status.toUpperCase()
      : null;
  };
}