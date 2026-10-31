// Statistics helpers for the NF-001 benchmark.

// Nearest-rank percentile of an ascending list of numbers.
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function summarize(durationsMs, errors = 0) {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const round = (value) => (value === null ? null : Math.round(value * 10) / 10);
  return {
    requests: sorted.length + errors,
    errors,
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.length ? sorted[sorted.length - 1] : null),
  };
}

// An endpoint passes when it has no errors and its 90th percentile is within the limit.
export function passes(summary, limitMs) {
  return summary.errors === 0 && summary.p90 !== null && summary.p90 <= limitMs;
}
