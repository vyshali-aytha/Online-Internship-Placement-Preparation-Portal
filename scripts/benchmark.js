// NF-001: measures page-load and search response times under normal load.
//   npm run benchmark
// Settings (environment variables, all optional):
//   BASE_URL               default http://localhost:4000
//   BENCH_REQUESTS         requests per endpoint, default 200
//   BENCH_CONCURRENCY      simultaneous users, default 10
//   BENCH_LIMIT_MS         pass mark for the 90th percentile, default 3000
//   BENCH_STUDENT_TOKEN    a student login token (otherwise one is signed from JWT_SECRET in .env)
//   BENCH_RECRUITER_TOKEN  an approved recruiter's token: also measures recruiter routes
//   BENCH_LISTING_ID       one of that recruiter's listing IDs: also measures the applicants route
//   BENCH_INSECURE         set to true to accept the self-signed local HTTPS certificate
// Before measuring search, load realistic data with: npm run bench:seed
// Writes logs/benchmark-<time>.md. Exits with 1 if any endpoint is over the limit.
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import { summarize, passes } from './benchmark-lib.js';

dotenv.config({ path: path.resolve('.env') });

const base = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const total = Math.max(1, Number(process.env.BENCH_REQUESTS || 200));
const concurrency = Math.max(1, Number(process.env.BENCH_CONCURRENCY || 10));
const limitMs = Number(process.env.BENCH_LIMIT_MS || 3000);

if (process.env.BENCH_INSECURE === 'true') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function studentToken() {
  if (process.env.BENCH_STUDENT_TOKEN) return process.env.BENCH_STUDENT_TOKEN;
  try {
    const { signJwt } = await import('../server/security.js');
    return signJwt('1', 'STUDENT');
  } catch {
    return null;
  }
}

function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

// One API request: resolves to true when the server answered 200.
function apiRequest(pathname, token) {
  return async () => {
    const response = await fetch(base + pathname, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(15000),
    });
    await response.arrayBuffer();
    return response.status === 200;
  };
}

// A page load: the HTML plus every /assets/ file it references, fetched together.
async function pageLoad() {
  const page = await fetch(base + '/', { signal: AbortSignal.timeout(15000) });
  if (page.status !== 200) return false;
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const results = await Promise.all(assets.map(async (asset) => {
    const response = await fetch(base + asset, { signal: AbortSignal.timeout(15000) });
    await response.arrayBuffer();
    return response.status === 200;
  }));
  return results.every(Boolean);
}

async function measure(name, run) {
  const durations = [];
  let errors = 0;
  let next = 0;

  for (let i = 0; i < 5; i += 1) {
    try { await run(); } catch { /* warm-up, not recorded */ }
  }

  async function worker() {
    while (next < total) {
      next += 1;
      const started = performance.now();
      try {
        if (await run()) durations.push(performance.now() - started);
        else errors += 1;
      } catch {
        errors += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  next = 0;
  return { name, ...summarize(durations, errors) };
}

const token = await studentToken();
const scenarios = [
  { name: 'Page load (HTML + assets)', run: pageLoad },
  { name: 'Readiness check', run: apiRequest('/api/health/ready') },
];

if (token) {
  scenarios.push(
    { name: 'Search: all active listings', run: apiRequest('/api/student/listings', token) },
    { name: 'Search: by role', run: apiRequest('/api/student/listings?role=intern', token) },
    { name: 'Search: by location', run: apiRequest('/api/student/listings?location=bengal', token) },
    { name: 'Search: by minimum CGPA', run: apiRequest('/api/student/listings?minCgpa=7.5', token) },
    { name: 'Search: role + location + CGPA', run: apiRequest('/api/student/listings?role=intern&location=bengal&minCgpa=7.5', token) },
    { name: 'Student applications', run: apiRequest('/api/student/applications', token) },
  );
} else {
  console.log('No student token and no JWT_SECRET: skipping search routes.');
}

if (process.env.BENCH_RECRUITER_TOKEN) {
  const rt = process.env.BENCH_RECRUITER_TOKEN;
  scenarios.push({ name: 'Recruiter: own listings', run: apiRequest('/api/recruiter/listings', rt) });
  if (process.env.BENCH_LISTING_ID) {
    scenarios.push({
      name: 'Recruiter: applicants for a listing',
      run: apiRequest(`/api/recruiter/listings/${process.env.BENCH_LISTING_ID}/applicants`, rt),
    });
  }
}

console.log(`Benchmark: ${base}, ${total} requests per endpoint, ${concurrency} at a time, limit ${limitMs} ms (p90)\n`);

const results = [];
for (const scenario of scenarios) {
  const result = await measure(scenario.name, scenario.run);
  result.pass = passes(result, limitMs);
  results.push(result);
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name.padEnd(36)} p50 ${result.p50} ms  p90 ${result.p90} ms  p99 ${result.p99} ms  max ${result.max} ms  errors ${result.errors}`);
}

const lines = [
  `# Benchmark ${new Date().toISOString()}`,
  '',
  `Target: ${base}. ${total} requests per endpoint, ${concurrency} at a time. Pass mark: p90 <= ${limitMs} ms and no errors.`,
  '',
  '| Endpoint | Requests | Errors | p50 (ms) | p90 (ms) | p99 (ms) | Max (ms) | Result |',
  '|---|---|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.requests} | ${r.errors} | ${r.p50} | ${r.p90} | ${r.p99} | ${r.max} | ${r.pass ? 'PASS' : 'FAIL'} |`),
];
fs.mkdirSync('logs', { recursive: true });
const out = path.join('logs', `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`\nSaved ${out}`);

process.exit(results.every((r) => r.pass) ? 0 : 1);
