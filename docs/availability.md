# Availability during demonstration and evaluation hours (OIPP-NF-002)

Goal: the application stays reachable and its core features keep working during
scheduled demonstrations and evaluation, and any unplanned downtime is recorded.

## Before a demonstration (about 5 minutes)

1. Pull the latest `main`, run `npm ci`, then `npm run build` (the web app is served from `dist/`).
2. Make sure MySQL is running and the migrations in `database/` have been applied.
3. Start the server: `npm start`.
4. Run the smoke check in a second terminal: `npm run smoke`.
   Every line must say PASS. It confirms the server, the database, the web app and
   that the student, recruiter and admin routes are alive and protected.
5. Optional deeper check: log in as a student and as an approved recruiter, copy each
   login token, and run the smoke check with `SMOKE_STUDENT_TOKEN` and
   `SMOKE_RECRUITER_TOKEN` set (see the comments at the top of `scripts/smoke-check.js`).
6. Leave the uptime monitor running for the whole session: `npm run uptime`.
   It checks `/api/health/ready` every 30 seconds (the database must answer within 2 seconds).

For local HTTPS (SR-001) use `BASE_URL=https://localhost:4443` and `UPTIME_INSECURE=true`.

## What gets recorded

- `logs/uptime-<date>.csv`: every check (time, up/down, HTTP status, response time, symptom).
- `logs/uptime-summary-<time>.md`: written when the monitor stops (Ctrl+C). It lists the
  availability percentage and each outage with its start, end and length.
  An outage starts at the first failed check and ends at the first successful one, so its
  length is accurate to within one polling interval.
- `logs/` is not committed. Copy the summary rows into the table below.

## What counts as a failure

The readiness check fails (HTTP 503) when the database does not answer, and the monitor
also records connection errors and responses slower than 5 seconds. Application errors are
written to the server log through `safeLog`, which removes personal data.

## Incident log

Add one row per unplanned outage or service failure. Fill in the cause and the fix after
the session.

| Date | Start (UTC) | End (UTC) | Duration | Symptom | Cause | Fix / follow-up |
|---|---|---|---|---|---|---|
| _none recorded yet_ | | | | | | |

## Monitoring results

| Session | Duration | Checks | Failed | Availability |
|---|---|---|---|---|
| _add after each demonstration_ | | | | |
