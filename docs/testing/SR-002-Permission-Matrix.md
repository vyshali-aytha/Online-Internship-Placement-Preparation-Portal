# SR-002 — Role-Based Access Control Validation

Date: 08 November 2026

## Permission matrix

| Endpoint / operation | Student | Approved recruiter | Admin |
|---|---|---|---|
| GET /api/student/listings | ALLOW | DENY | DENY |
| GET /api/mock-interviews/slots | ALLOW | DENY | DENY |
| POST /api/mock-interviews/bookings | ALLOW | DENY | DENY |
| GET /api/mock-interviews/my-bookings | ALLOW | DENY | DENY |
| POST /api/recruiter/listings | DENY | ALLOW | DENY |
| POST /api/recruiter/listings/:id/publish | DENY | ALLOW | DENY |
| POST /api/recruiter/listings/:id/close | DENY | ALLOW | DENY |
| GET /api/recruiter/listings | DENY | ALLOW | DENY |
| GET /api/recruiter/listings/:listingId/applicants | DENY | ALLOW | DENY |
| PATCH /api/recruiter/applications/:applicationId/status | DENY | ALLOW | DENY |
| GET /api/admin/placement-summary | DENY | DENY | ALLOW |
| GET /api/admin/recruiter-requests | DENY | DENY | ALLOW |
| PATCH /api/admin/recruiter-requests/:id/status | DENY | DENY | ALLOW |
| POST /api/mock-interviews/admin/slots | DENY | DENY | ALLOW |
| GET /api/mock-interviews/admin/bookings | DENY | DENY | ALLOW |
| PATCH /api/mock-interviews/admin/bookings/:bookingId/feedback | DENY | DENY | ALLOW |

Recruiter-only permissions additionally require current recruiter approval.
Listing and applicant ownership is checked by the backend.

## Automated test evidence

- tests/auth-security.test.js
- tests/rbac-integration.test.js
- tests/rbac-routes.test.js
- tests/listings.test.js
- tests/mock-interviews.test.js
- tests/recruiter-listings.test.js
- tests/recruiter-applicants.test.js

The tests cover role matching, cross-role denial, unauthenticated access,
live recruiter approval, recruiter ownership boundaries and admin-only routes.

## Limitation

The permission matrix documents the intended access policy and the
automated tests exercise representative route and role combinations.
It is not a claim that every endpoint-role combination has been
exhaustively tested against a live production database.
