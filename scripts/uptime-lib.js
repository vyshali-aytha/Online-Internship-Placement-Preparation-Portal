// Tracks downtime incidents from a series of up/down checks (NF-002).
// An incident starts at the first failed check and ends at the first successful
// check after it, so its length is accurate to within one polling interval.

export function createIncidentTracker() {
  let open = null;
  const incidents = [];
  let total = 0;
  let failed = 0;

  function close(at, ongoing) {
    open.end = at;
    open.ongoing = ongoing;
    incidents.push(open);
    open = null;
  }

  return {
    record({ ok, at = new Date(), detail = '' }) {
      total += 1;
      if (!ok) failed += 1;

      if (!ok && !open) {
        open = { start: at, end: null, failedChecks: 1, detail, ongoing: false };
      } else if (!ok && open) {
        open.failedChecks += 1;
      } else if (ok && open) {
        close(at, false);
      }
    },

    finish(at = new Date()) {
      if (open) close(at, true);
    },

    summary() {
      return {
        totalChecks: total,
        failedChecks: failed,
        availabilityPercent: total === 0 ? null : Number((((total - failed) / total) * 100).toFixed(2)),
        incidents: incidents.map((incident) => ({
          start: incident.start.toISOString(),
          end: incident.end.toISOString(),
          durationSeconds: Math.round((incident.end - incident.start) / 1000),
          failedChecks: incident.failedChecks,
          detail: incident.detail,
          ongoing: incident.ongoing,
        })),
      };
    },
  };
}
