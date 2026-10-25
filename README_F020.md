# F-020 Recruiter Account Request

Endpoints
- POST /api/recruiter-requests        (body: fullName, email, companyName, password) -> 201 {id, email, status: "PENDING"}
- GET  /api/admin/recruiter-requests  (admin only) -> list of PENDING requests

Table: recruiter_requests (see database/schema.sql)

Manual test steps
1. Run database/schema.sql in MySQL
2. cd backend && cp .env.example .env (fill DB values) && npm install && npm start
3. POST valid body -> 201 with status PENDING; same email again -> 409; bad body -> 400
4. npm test -> all tests pass

Note: adminOnly middleware is a temporary placeholder until #18 (RBAC) is merged.
