import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createHealthRouter } from '../server/health.js';
import { createIncidentTracker } from '../scripts/uptime-lib.js';

const t = (seconds) => new Date(Date.UTC(2026, 10, 2, 9, 0, seconds));

test('no failures means 100% availability and no incidents', () => {
  const tracker = createIncidentTracker();
  for (let i = 0; i < 4; i += 1) tracker.record({ ok: true, at: t(i * 30) });
  tracker.finish(t(120));
  const summary = tracker.summary();
  assert.equal(summary.availabilityPercent, 100);
  assert.deepEqual(summary.incidents, []);
});

test('an outage is recorded from the first failed check to recovery', () => {
  const tracker = createIncidentTracker();
  tracker.record({ ok: true, at: t(0) });
  tracker.record({ ok: false, at: t(30), detail: 'HTTP 503' });
  tracker.record({ ok: false, at: t(60), detail: 'HTTP 503' });
  tracker.record({ ok: true, at: t(90) });
  tracker.finish(t(120));

  const { incidents, failedChecks, totalChecks } = tracker.summary();
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].durationSeconds, 60);
  assert.equal(incidents[0].failedChecks, 2);
  assert.equal(incidents[0].detail, 'HTTP 503');
  assert.equal(incidents[0].ongoing, false);
  assert.equal(failedChecks, 2);
  assert.equal(totalChecks, 4);
});

test('separate outages are separate incidents', () => {
  const tracker = createIncidentTracker();
  tracker.record({ ok: false, at: t(0), detail: 'a' });
  tracker.record({ ok: true, at: t(30) });
  tracker.record({ ok: false, at: t(60), detail: 'b' });
  tracker.record({ ok: true, at: t(90) });
  assert.equal(tracker.summary().incidents.length, 2);
});

test('an outage still going when monitoring stops is flagged as ongoing', () => {
  const tracker = createIncidentTracker();
  tracker.record({ ok: true, at: t(0) });
  tracker.record({ ok: false, at: t(30), detail: 'timeout after 5s' });
  tracker.finish(t(90));
  const { incidents, availabilityPercent } = tracker.summary();
  assert.equal(incidents[0].ongoing, true);
  assert.equal(incidents[0].durationSeconds, 60);
  assert.equal(availabilityPercent, 50);
});

async function readiness(dbPool, options) {
  const app = express();
  app.use('/api', createHealthRouter(dbPool, options));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health/ready`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('readiness is 200 when the database answers', async () => {
  const res = await readiness({ query: async () => [[{ 1: 1 }]] });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'up');
});

test('readiness is 503 when the database fails, without leaking error details', async () => {
  const res = await readiness({
    query: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:3306 user 'oipp'"); },
  });
  assert.equal(res.status, 503);
  assert.equal(res.body.database, 'down');
  assert.equal(JSON.stringify(res.body).includes('ECONNREFUSED'), false);
  assert.equal(JSON.stringify(res.body).includes('oipp'), false);
});

test('readiness is 503, not a hang, when the database never answers', async () => {
  const res = await readiness({ query: () => new Promise(() => {}) }, { timeoutMs: 50 });
  assert.equal(res.status, 503);
});
