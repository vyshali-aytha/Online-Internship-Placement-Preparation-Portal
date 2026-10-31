// NF-002: quick "is everything alive?" check to run before a demonstration.
//   npm run smoke
// Settings (environment variables, all optional):
//   BASE_URL               default http://localhost:4000
//   SMOKE_STUDENT_TOKEN    a student login token: also checks listings and applications
//   SMOKE_RECRUITER_TOKEN  an approved recruiter's token: also checks recruiter listings
//   UPTIME_INSECURE        set to true to accept the self-signed local HTTPS certificate
const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

if (process.env.UPTIME_INSECURE === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const checks = [
  { name: 'Server is up', path: '/api/health', expect: 200 },
  { name: 'Database is reachable', path: '/api/health/ready', expect: 200 },
  { name: 'Web app is served', path: '/', expect: 200 },
  { name: 'Student listings route is alive and protected', path: '/api/student/listings', expect: 401 },
  { name: 'Recruiter listings route is alive and protected', path: '/api/recruiter/listings', expect: 401 },
  { name: 'Admin route is alive and protected', path: '/api/admin/recruiter-requests', expect: 401 },
];

if (process.env.SMOKE_STUDENT_TOKEN) {
  const token = process.env.SMOKE_STUDENT_TOKEN;
  checks.push(
    { name: 'Student can view listings', path: '/api/student/listings', expect: 200, token },
    { name: 'Student can view applications', path: '/api/student/applications', expect: 200, token },
  );
}
if (process.env.SMOKE_RECRUITER_TOKEN) {
  checks.push({
    name: 'Approved recruiter can view own listings',
    path: '/api/recruiter/listings',
    expect: 200,
    token: process.env.SMOKE_RECRUITER_TOKEN,
  });
}

let failures = 0;
for (const check of checks) {
  let result;
  try {
    const response = await fetch(base + check.path, {
      headers: check.token ? { authorization: `Bearer ${check.token}` } : {},
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
    });
    result = { ok: response.status === check.expect, got: response.status };
  } catch (error) {
    result = { ok: false, got: error.name === 'TimeoutError' ? 'timeout' : 'no response' };
  }
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${check.name}  (${check.path}: expected ${check.expect}, got ${result.got})`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
