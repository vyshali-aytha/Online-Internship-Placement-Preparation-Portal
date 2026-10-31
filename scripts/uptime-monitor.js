// NF-002: checks the application every few seconds and records downtime.
//   npm run uptime
// Settings (environment variables, all optional):
//   HEALTH_URL        default http://localhost:4000/api/health/ready
//   INTERVAL_SECONDS  default 30
//   DURATION_MINUTES  default 0 (run until Ctrl+C)
//   UPTIME_INSECURE   set to true to accept the self-signed local HTTPS certificate
// Output: logs/uptime-<date>.csv (every check) and logs/uptime-summary-<time>.md
// (availability and an incident table to paste into docs/availability.md).
import fs from 'node:fs';
import path from 'node:path';
import { createIncidentTracker } from './uptime-lib.js';

const url = process.env.HEALTH_URL || 'http://localhost:4000/api/health/ready';
const intervalMs = Math.max(1, Number(process.env.INTERVAL_SECONDS || 30)) * 1000;
const durationMs = Number(process.env.DURATION_MINUTES || 0) * 60 * 1000;

if (process.env.UPTIME_INSECURE === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const logDir = path.resolve('logs');
fs.mkdirSync(logDir, { recursive: true });
const day = new Date().toISOString().slice(0, 10);
const csvPath = path.join(logDir, `uptime-${day}.csv`);
if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, 'timestamp,ok,status,ms,detail\n');

const tracker = createIncidentTracker();
let stopping = false;

async function check() {
  const at = new Date();
  const started = Date.now();
  let ok = false;
  let status = 0;
  let detail = '';

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    status = response.status;
    ok = response.status === 200;
    if (!ok) detail = `HTTP ${response.status}`;
  } catch (error) {
    detail = error.name === 'TimeoutError' ? 'timeout after 5s' : `connection failed (${error.cause?.code || error.name})`;
  }

  const ms = Date.now() - started;
  tracker.record({ ok, at, detail });
  fs.appendFileSync(csvPath, `${at.toISOString()},${ok},${status},${ms},${detail}\n`);
  console.log(`${at.toISOString()}  ${ok ? 'UP  ' : 'DOWN'}  ${status || '-'}  ${ms}ms  ${detail}`);
}

function stop() {
  if (stopping) return;
  stopping = true;
  tracker.finish();
  const summary = tracker.summary();

  const lines = [
    `# Uptime summary (${url})`,
    '',
    `- Checks: ${summary.totalChecks}, failed: ${summary.failedChecks}`,
    `- Availability: ${summary.availabilityPercent ?? 'n/a'}%`,
    '',
    '| Start (UTC) | End (UTC) | Duration (s) | Failed checks | Symptom | Cause / fix |',
    '|---|---|---|---|---|---|',
    ...summary.incidents.map((i) =>
      `| ${i.start} | ${i.end}${i.ongoing ? ' (still down)' : ''} | ${i.durationSeconds} | ${i.failedChecks} | ${i.detail} | |`),
  ];
  if (summary.incidents.length === 0) lines.push('| none | | | | | |');

  const summaryPath = path.join(logDir, `uptime-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  fs.writeFileSync(summaryPath, lines.join('\n') + '\n');

  console.log('\n' + lines.join('\n'));
  console.log(`\nSaved ${summaryPath}`);
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(`Monitoring ${url} every ${intervalMs / 1000}s. Press Ctrl+C to stop.`);
if (durationMs > 0) setTimeout(stop, durationMs);

await check();
while (!stopping) {
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
  if (!stopping) await check();
}
