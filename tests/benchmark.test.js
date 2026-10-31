import test from 'node:test';
import assert from 'node:assert/strict';

import { percentile, summarize, passes } from '../scripts/benchmark-lib.js';

const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

test('percentiles use the nearest-rank method', () => {
  assert.equal(percentile(oneToHundred, 50), 50);
  assert.equal(percentile(oneToHundred, 90), 90);
  assert.equal(percentile(oneToHundred, 99), 99);
  assert.equal(percentile(oneToHundred, 100), 100);
  assert.equal(percentile([5], 90), 5);
  assert.equal(percentile([], 90), null);
});

test('summarize reports the 90th percentile and ignores input order', () => {
  const shuffled = [...oneToHundred].reverse();
  const summary = summarize(shuffled);
  assert.equal(summary.p90, 90);
  assert.equal(summary.max, 100);
  assert.equal(summary.requests, 100);
  assert.equal(summary.errors, 0);
});

test('failed requests are counted and never hide a slow endpoint', () => {
  const summary = summarize([10, 20, 30], 2);
  assert.equal(summary.requests, 5);
  assert.equal(summary.errors, 2);
});

test('an endpoint passes only with no errors and p90 within the limit', () => {
  assert.equal(passes(summarize([100, 200, 300]), 3000), true);
  assert.equal(passes(summarize([100, 200, 4000]), 3000), false);
  assert.equal(passes(summarize([100, 200, 300], 1), 3000), false);
  assert.equal(passes(summarize([], 5), 3000), false);
});

test('a slow tail above 10% pushes the 90th percentile over the limit', () => {
  const times = [...Array(85).fill(100), ...Array(15).fill(3500)];
  assert.equal(passes(summarize(times), 3000), false);
  const mostlyFast = [...Array(95).fill(100), ...Array(5).fill(3500)];
  assert.equal(passes(summarize(mostlyFast), 3000), true);
});
