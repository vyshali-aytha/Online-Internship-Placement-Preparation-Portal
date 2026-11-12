# Unit Test Report
## Online Internship & Placement Preparation Portal (OIPP)

**Prepared by:** Vyshali  
**Project:** Online Internship & Placement Preparation Portal  
**Test execution date:** 11 November 2026  
**Tested commit:** `a709ae6f9a83cbd58517c1c3592c6a257cadf839`  
**Document status:** Unit Test Report

---

## 1. Introduction

This report documents the automated tests executed for the Online Internship & Placement Preparation Portal (OIPP). It describes the purpose and scope of testing, the test environment and tools, the organisation of the test suite, the scenarios covered, the execution procedure, and the observed results.

The testing focuses on verifying selected backend functions, validation rules, authentication and authorisation controls, middleware, API routes, and supporting application behaviour.

## 2. Objectives

The objectives of the unit testing activity are to:

- Verify that selected functions and application components behave as expected.
- Check the handling of valid, invalid, missing, and unauthorised inputs.
- Verify selected authentication, token-validation, and role-based access-control behaviour.
- Check selected student, recruiter, and administrator operations.
- Detect unexpected behaviour during automated test execution.
- Record the test results and identify scenarios that require additional testing.

## 3. Scope of Testing

The automated test suite covers selected areas of the OIPP backend, including:

- Authentication, password-related behaviour, and JWT validation.
- Role-based access control and recruiter approval restrictions.
- Student input and profile validation.
- Internship and placement listing visibility and filtering.
- Recruiter listing creation and management.
- Recruiter account requests and approval-related routes.
- Applicant viewing, ownership checks, and application-status decisions.
- Mock interview and mock test operations.
- Administrator placement-summary calculations.
- Availability and readiness-check behaviour.
- HTTPS enforcement and request handling.
- Sensitive-data redaction and security-event handling.
- Selected benchmark calculations.

The test suite contains unit-level tests as well as middleware, route/API, and integration-style tests. These tests exercise different levels of application behaviour; therefore, the entire suite is not classified as exclusively isolated unit tests.

## 4. Testing Environment

| Component | Configuration |
|---|---|
| Operating system | Windows |
| Runtime | Node.js v22.19.0 |
| Package manager | npm 10.9.3 |
| Project module system | JavaScript ES modules |
| Test framework | Node.js built-in `node:test` |
| Assertion library | `node:assert/strict` |
| Test command | `npm test` |
| Tested commit | `a709ae6f9a83cbd58517c1c3592c6a257cadf839` |

Testing was performed from the project root directory in the local Windows development environment.

## 5. Testing Framework and Tools

### 5.1 Node.js built-in test runner

OIPP uses the Node.js built-in `node:test` module to define and execute automated tests. The test runner discovers and executes the test files in the project.

The test command configured for the project is:

```bash
npm test
```

This invokes:

```bash
node --test
```

### 5.2 Assertion library

The test suite uses `node:assert/strict` to compare actual results with expected results. Assertions are used to verify returned values, errors, response status codes, and other expected application behaviour.

### 5.3 Supporting techniques

The existing tests use supporting techniques such as:

- Fake or stubbed database-pool methods to control database responses.
- In-memory HTTP servers for selected route and middleware tests.
- `before` and `after` hooks to prepare and clean up test resources.
- Environment-variable setup and restoration for configuration-dependent tests.
- In-memory data structures and reset helpers to isolate test scenarios.

These techniques make it possible to test selected application behaviour in a controlled local environment without requiring every test to connect to production services.

## 6. Testing Approach

The automated testing process followed these steps:

1. Open the OIPP project in the local development environment.
2. Ensure the project dependencies are available.
3. Execute the test suite using `npm test`.
4. Allow the Node.js test runner to discover and execute the test files.
5. Review the output for individual test results and the overall summary.
6. Save the terminal output as evidence of the execution.

Tests are designed around specific scenarios. For each scenario, the test supplies controlled inputs or conditions, invokes the relevant function or application component, and checks whether the observed result matches the expected behaviour.

The suite includes tests for successful operations, invalid inputs, rejected requests, access-control restrictions, and selected error conditions.

## 7. Test Suite Organisation

The automated test suite contains 18 test files with a total of 125 declared tests.

| No. | Test file | Number of tests |
|---:|---|---:|
| 1 | `admin-placement-summary.test.js` | 4 |
| 2 | `auth-security.test.js` | 10 |
| 3 | `auth-token-validation.test.js` | 11 |
| 4 | `availability.test.js` | 8 |
| 5 | `benchmark.test.js` | 5 |
| 6 | `https.test.js` | 9 |
| 7 | `listings.test.js` | 12 |
| 8 | `mock-interviews.test.js` | 6 |
| 9 | `mock-tests.test.js` | 8 |
| 10 | `rbac-integration.test.js` | 2 |
| 11 | `rbac-routes.test.js` | 6 |
| 12 | `recruiter-applicants.test.js` | 12 |
| 13 | `recruiter-listings.test.js` | 10 |
| 14 | `recruiter-requests.test.js` | 6 |
| 15 | `recruiterApproval.test.js` | 4 |
| 16 | `safeLog.test.js` | 5 |
| 17 | `securityEvents.test.js` | 4 |
| 18 | `student-validation.test.js` | 3 |
| | **Total** | **125** |

## 8. Test Case Inventory

The following table summarises the main scenarios exercised by each test file. The descriptions are grouped by test file to keep the report readable while documenting the functional purpose of the tests.

| Test file | Test scenarios / behaviour verified |
|---|---|
| `admin-placement-summary.test.js` | Administrator authentication for the summary operation; placement-summary aggregation; filtering by branch and date; validation of invalid date inputs. |
| `auth-security.test.js` | Password hashing and verification behaviour; JWT claims and configuration checks; handling of invalid or tampered token data; role-based middleware; recruiter approval restrictions. |
| `auth-token-validation.test.js` | JWT creation and expected claims; acceptance of valid tokens; rejection of malformed, tampered, expired, or unsupported-algorithm tokens; configuration validation. |
| `availability.test.js` | Application readiness and availability behaviour; handling of database timeouts and database failures. |
| `benchmark.test.js` | Benchmark calculation logic, including percentile calculations and evaluation against benchmark thresholds. |
| `https.test.js` | HTTPS enforcement; HTTP redirect and request handling; trusted-proxy behaviour; Host-header validation; TLS configuration and certificate loading. |
| `listings.test.js` | Visibility of listings; listing filters; input handling; SQL parameterisation checks. |
| `mock-interviews.test.js` | Viewing interview slots; booking a slot; prevention of duplicate bookings; administrator feedback; invalid input handling. |
| `mock-tests.test.js` | Test-attempt creation and retrieval; access restrictions; answer scoring; expiry-related behaviour. |
| `rbac-integration.test.js` | HTTP-level role enforcement; authenticated-user information through the `/api/auth/me` endpoint. |
| `rbac-routes.test.js` | Recruiter approval gating; administrator recruiter-request routes; approval and rejection decision endpoints. |
| `recruiter-applicants.test.js` | Viewing applicants; listing ownership checks; applicant status updates; sensitive-data redaction; concurrent update handling. |
| `recruiter-listings.test.js` | Recruiter listing creation; saving drafts and publishing; ownership restrictions; validation of invalid listing inputs. |
| `recruiter-requests.test.js` | Recruiter access-request creation; pending status; duplicate-request handling; invalid inputs; ensuring a request does not grant a recruiter token or privileges. |
| `recruiterApproval.test.js` | Recruiter approval-resolution logic and the resulting approval state. |
| `safeLog.test.js` | Redaction of sensitive information in logs, including email addresses, passwords, JWTs, and OTP values. |
| `securityEvents.test.js` | Security-event structure and filtering of event metadata. |
| `student-validation.test.js` | Student profile input validation and resume-file signature validation. |

### 8.1 Types of scenarios covered

The test suite includes the following broad scenario types:

- **Positive scenarios:** valid inputs, authorised access, and successful operations.
- **Negative scenarios:** invalid inputs, malformed tokens, expired tokens, and rejected requests.
- **Authorisation scenarios:** access allowed or denied according to user role, ownership, or recruiter approval state.
- **Validation scenarios:** checking required fields, formats, and acceptable input values.
- **Error-handling scenarios:** selected database failure, timeout, and invalid-configuration conditions.
- **Security scenarios:** token validation, HTTPS policy, sensitive-data redaction, and access restrictions.

## 9. Test Execution Procedure

The complete automated test suite was executed from the OIPP project root.

**Command used:**

```bash
npm test
```

The command invokes the Node.js test runner through the project's npm script. The runner discovers and executes the available test files and displays the result of each test.

The execution output was saved in:

```text
docs/testing/evidence/unit-test-output.txt
```

## 10. Test Execution Results

The latest recorded execution produced the following summary:

| Result metric | Count |
|---|---:|
| Total test files | 18 |
| Total tests | 125 |
| Passed | 125 |
| Failed | 0 |
| Skipped | 0 |
| Cancelled | 0 |

<details>
<summary>Execution summary</summary>

```text
1..125
# tests 125
# suites 0
# pass 125
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

</details>

**Overall result: PASS**

All 125 tests passed in the recorded execution. No test failures, skipped tests, or cancelled tests were reported.

The saved output records an execution duration of approximately 12.51 seconds. The duration may vary across subsequent runs depending on the machine and environment.

## 11. Identified Areas Requiring Additional Tests

The review of the current test inventory identified some scenarios for which direct or complete automated tests were not identified. These are potential areas for strengthening the test suite.

| Area | Observation |
|---|---|
| OTP registration | Direct tests for the complete OTP request and verification flow were not identified. |
| Student login | Direct success and failure tests for the complete login flow were not identified. |
| Account lockout | Direct assertions for failed-login counters and lockout timestamps were not identified. |
| Student profile management | Validation is tested, but complete profile create, read, update, and delete behaviour was not identified. |
| Resume handling | Resume signature validation is tested; complete upload and replacement behaviour was not identified. |
| PDF generation | A direct automated test for the complete PDF-generation flow was not identified. |
| Application submission | A direct automated test for student application submission was not identified. |
| Application tracking | Recruiter-side status updates are tested; complete student-facing application tracking was not identified. |
| Duplicate applications | An explicit test for preventing duplicate applications was not identified. |
| Interview question bank | A direct automated test for the question-bank functionality was not identified. |

These observations are based on the reviewed test inventory. They indicate areas where additional automated tests may be useful; they do not establish that the corresponding application features are absent or non-functional.

## 12. Limitations

The following limitations apply to the tests described in this report:

- Some tests use fake or stubbed database-pool methods rather than connecting to a live MySQL database.
- Selected route tests use in-memory HTTP servers and controlled test data.
- Real SMTP email delivery is not verified by the recorded test execution.
- External API behaviour is not verified by the recorded test execution.
- The tests cover selected application components and scenarios; they do not represent a complete end-to-end test of every OIPP workflow.
- Results from a local test environment do not, by themselves, establish behaviour in a deployed production environment.
- Passing tests demonstrate that the tested scenarios produced the expected results; they do not guarantee the absence of all defects.

## 13. Conclusion

The automated test suite for OIPP was executed successfully in the local Windows development environment using Node.js v22.19.0 and npm 10.9.3.

A total of 125 tests across 18 test files were executed. All 125 tests passed, with zero failures, zero skipped tests, and zero cancelled tests.

The suite exercises selected application logic, input validation, authentication, authorisation, route behaviour, recruiter operations, student-related functionality, and security controls. The review also identified areas where additional automated tests could improve the coverage of important application workflows.

Overall, the recorded execution indicates that the scenarios included in the existing automated test suite passed successfully.

## 14. Test Evidence

The terminal output from the recorded test execution is retained at:

```text
docs/testing/evidence/unit-test-output.txt
```

This file provides the execution summary supporting the results documented in this report.
