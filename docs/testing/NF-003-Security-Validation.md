# NF-003 — Security Validation Report

Date: 08 November 2026
Environment: Local testing environment
Database: oipp_testing

## Results

| Test | Result | Evidence |
|---|---|---|
| Environment file protection | PASS | .env ignored by Git; not tracked |
| Production dependency audit | PASS | npm audit --omit=dev: 0 vulnerabilities |
| Password hashing | PASS | bcrypt.hash and bcrypt.compare used |
| Sensitive log redaction | PASS | safeLog.js redacts emails, hashes, JWTs, bearer tokens and secret values |
| Security event filtering | PASS | securityEvents.js uses an allowlist |
| Database credential configuration | PASS | DB connection values loaded from environment variables |
| Application HTTPS | PARTIAL | ENABLE_HTTPS=false and ENFORCE_HTTPS=false locally |
| Database encrypted transport | NOT VERIFIED | MySQL pool configuration has no explicit SSL option |

## Conclusion

Password hashing, sensitive-data redaction, environment-file protection
and production dependency checks passed.

Encrypted transport requires further verification. Local HTTP is currently
enabled, and the MySQL connection does not explicitly configure TLS in
server/db.js. No claim of end-to-end encrypted transport is made.

Production deployment settings and database-provider TLS configuration
remain outside this local validation.
