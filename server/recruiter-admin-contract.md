# F-018 integration contract: pending team confirmation

The repository does not contain recruiter applications, recruiter status, administrator roles, or admin authorization middleware. F-018 must not be implemented against assumed tables or roles.

Before implementing recruiter approval/rejection, the team must confirm:

- Recruiter table name and primary key.
- Status values and whether pending, approved, and rejected are stored in one table or separate tables.
- Administrator representation and role claim used by JWT authentication.
- Existing endpoint paths and request/response conventions.
- Decision fields such as reviewer identity, decision timestamp, and rejection reason.
- Recruiter-only endpoints that approved status must authorize.

The intended backend boundary is:

- A read-only `listPendingRecruiters` adapter.
- An atomic `approveRecruiter(recruiterId, adminId)` adapter.
- An atomic `rejectRecruiter(recruiterId, adminId, reason)` adapter.
- A reusable `requireRecruiterAdmin` middleware after JWT authentication.

No route, SQL mutation, or role grant is included until those contracts exist. This avoids duplicate or conflicting shared data models.
