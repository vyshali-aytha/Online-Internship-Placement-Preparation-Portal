# OIPP Testing — Defect and Observation Log

Date: 08 November 2026
Branch: test/OIPP-yashas-part3

| ID | Requirement | Finding | Status |
|---|---|---|---|
| SR004-01 | SR-004 | Admin recruiter approval/rejection actions do not emit structured security events. | OPEN |
| NF003-01 | NF-003 | HTTPS enforcement is disabled in the local environment; production transport was not verified. | VERIFICATION GAP |
| NF003-02 | NF-003 | MySQL TLS/encrypted transport is not explicitly configured or verified in this testing run. | VERIFICATION GAP |

## SR004-01 details

Expected:
Approval and rejection actions should emit timestamped security events
with relevant actor and outcome metadata.

Observed:
The administrator approval/rejection route processes the decision but
does not invoke the structured security-event logger.

Impact:
The audit trail does not demonstrate the required approval/rejection
events.

Recommendation:
The implementation owner should add structured event logging and
corresponding tests.

No application implementation change was made by the testing owner.

## NF-003 verification gaps

The local environment has ENABLE_HTTPS=false and ENFORCE_HTTPS=false.
The database pool also has no explicit SSL configuration.

These observations do not establish whether a separate production
proxy or database provider supplies encryption. Production settings
require independent verification.
