# OIPP — Branch Coverage Report

**Tester:** Yashas
**Date:** 08 November 2026
**Branch:** test/OIPP-yashas-part3
**Base commit:** 514e631937ed809e0219f7cac390fd18323aa7e6
**Environment:** Windows / Node.js v20.19.5
**Test runner:** Node.js built-in test runner
**Coverage tool:** c8 v12.0.0

## 1. Objective

Measure decision and branch coverage for the backend modules associated
with the assigned functional, non-functional and security requirements.

The coverage scope includes 15 selected server and monitoring modules.
It does not represent coverage of the entire application.

## 2. Execution

The following command was used:

npx c8 --all --include "server/mock-interviews.js" --include "server/recruiter-listings.js" --include "server/recruiter-applicants.js" --include "server/listings.js" --include "server/health.js" --include "scripts/uptime-lib.js" --include "server/safeLog.js" --include "server/auth.js" --include "server/db.js" --include "server/security.js" --include "server/rbac-routes.js" --include "server/recruiterApproval.js" --include "server/securityEvents.js" --include "server/enforceHttps.js" --include "server/tls.js" --reporter=text --reporter=text-summary --reporter=html --reporter=lcov --reporter=json-summary --reports-dir=docs/testing/evidence/coverage npm test

## 3. Overall results

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Statements | 1588 | 2114 | 75.11% |
| Branches | 356 | 414 | 85.99% |
| Functions | 46 | 52 | 88.46% |
| Lines | 1588 | 2114 | 75.11% |

A total of 58 branches remained uncovered in the selected scope.

## 4. Per-file branch coverage

| Module | Branch coverage |
|---|---:|
| scripts/uptime-lib.js | 100% |
| server/db.js | 100% |
| server/recruiterApproval.js | 100% |
| server/securityEvents.js | 100% |
| server/listings.js | 96.55% |
| server/recruiter-applicants.js | 95% |
| server/security.js | 90.36% |
| server/enforceHttps.js | 90.9% |
| server/recruiter-listings.js | 86% |
| server/health.js | 87.5% |
| server/rbac-routes.js | 81.81% |
| server/mock-interviews.js | 76.08% |
| server/auth.js | 66.66% |
| server/tls.js | 58.33% |
| server/safeLog.js | 57.14% |

## 5. Coverage interpretation

The strongest branch coverage was achieved in the availability-monitoring
library, database configuration module, recruiter approval resolver and
security-event logger.

The following modules retain the largest relative branch-coverage gaps:

- safeLog.js: 57.14%
- tls.js: 58.33%
- auth.js: 66.66%
- mock-interviews.js: 76.08%

Additional uncovered decisions exist in rbac-routes.js and
recruiter-listings.js.

The detailed HTML and LCOV reports should be consulted to identify
individual uncovered branch locations and true/false outcomes. The
aggregate percentage alone does not identify the semantic meaning of
every uncovered decision.

## 6. Tests added during this testing activity

The following additional tests were added on the isolated testing branch:

- Recruiter approval resolver: invalid database pools, invalid IDs,
  status normalization and database-error propagation.
- Mock interviews: invalid slot times, unavailable slots, duplicate
  slot creation and administrator booking review.
- Recruiter applicants: invalid identifiers, missing applications,
  malformed profile snapshots and concurrent status-update conflicts.
- Availability monitoring: empty monitoring windows.
- Security logging: allowlisted metadata and non-finite metadata values.
- Safe logging: redaction of email addresses, password hashes, JWTs,
  bearer tokens, passwords and OTP values.

No application implementation files were changed as part of these
test additions.

## 7. Supporting test and build results

- Automated test suite: 124 passed, 0 failed, 0 skipped.
- Production build: passed.
- SR-002 targeted tests: 57 passed, 0 failed.
- SR-004 targeted tests: 15 passed, 0 failed.
- Production dependency audit: 0 vulnerabilities using
  npm audit --omit=dev.

## 8. Evidence artefacts

Coverage output:
- docs/testing/evidence/coverage-html-report.zip
- docs/testing/evidence/coverage/lcov.info
- docs/testing/evidence/coverage/coverage-summary.json

Other requirement evidence:
- docs/testing/evidence/F-014/
- docs/testing/evidence/uptime/
- docs/testing/evidence/SR-002/rbac-test-results.txt
- docs/testing/evidence/SR-004/security-event-test-results.txt
- docs/testing/NF-003-Security-Validation.md
- docs/testing/SR-002-Permission-Matrix.md
- docs/testing/SR-004-Security-Event-Review.md

## 9. Limitations

1. Coverage is scoped to 15 selected backend and monitoring modules.
   It is not whole-application coverage.
2. The React Question Bank component is validated separately through
   manual browser testing.
3. Several feature tests use controlled/mock database pools. Their
   success does not prove every workflow against a production database.
4. Uptime evidence represents a two-minute local monitoring window,
   not continuous production availability.
5. Local HTTPS is disabled and MySQL encrypted transport was not
   verified during this run.
6. SR-004 approval/rejection event logging remains an identified
   requirement gap.
7. Branches that remain uncovered should be reviewed using the
   detailed HTML and LCOV reports rather than treated as successful
   execution paths.

## 10. Conclusion

The selected modules achieved 85.99% branch coverage, with 356 of
414 branches covered. The automated suite passed all 124 tests and
the production build succeeded.

The report records the measured coverage, the tests added, the
remaining branch gaps and the limitations of the selected scope.
