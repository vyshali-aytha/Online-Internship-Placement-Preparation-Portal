# SR-004 — Security Event Logging Review

Date: 08 November 2026

## Verified capabilities

- Security event records contain ISO timestamps.
- Events have a structured event identifier.
- Only allowlisted metadata fields are recorded.
- Arbitrary request fields, passwords, tokens and emails are excluded.
- Invalid event identifiers are rejected.
- Recruiter login success, denial and failure events are present.
- Admin login success and failure events are present.
- Student login success, failure and lockout event calls exist in auth.js.

## Open requirement gap

Finding: SR004-01

Expected:
Admin recruiter approval and rejection actions should produce timestamped
security events identifying the actor, target and decision outcome.

Observed:
The admin recruiter approval/rejection route processes the decision but
does not invoke logSecurityEvent.

Status: OPEN — implementation change required.

## Testing limitation

Student login event branches have been confirmed by source inspection.
The current targeted test suite does not independently demonstrate every
student login success, failure and lockout event scenario.

SR-004 is therefore PARTIAL, not fully passed.
