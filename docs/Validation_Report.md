# SOFTWARE ENGINEERING PROJECT

# SYSTEM VALIDATION REPORT

## Online Internship & Placement Preparation Portal (OIPP)

| TEAM MEMBER | SRN |
|---|---|
| Vyshali Aytha | PES2UG24CS603 |
| Vismaya Harish | PES2UG24CS598 |
| Thejus A Reddy | PES2UG24CS564 |
| Yashas Sadananda | PES2UG24CS610 |

---

## 1. Executive Summary

This report consolidates the validation activities documented for OIPP. It brings together student profile and resume-related checks, mock-test and score-history checks, recruiter and administrator workflows, listing and applicant-management checks, performance and availability measurements, HTTPS enforcement, password/personal-data security, and the manual RTM scenarios.

## 2. System Overview

OIPP is an Online Internship & Placement Preparation Portal intended to support student internship/placement preparation and interactions among students, recruiters and placement-cell administrators.

The evidence supplied covers student registration and login, profile management, resume handling and PDF generation, mock assessments, opportunity browsing and filtering, recruiter access requests, recruiter listing management, applicant review, administrative approval/rejection, placement summary reporting, and supporting security and operational controls.

## 3. Objectives and Scope

- Validate that the documented functional workflows behave according to their stated expected outcomes.
- Review non-functional evidence for performance, availability and accessibility.
- Review security evidence for password hashing, personal-data authorization, log redaction and HTTPS enforcement.
- Trace each reported outcome to the corresponding source evidence and identify incomplete or unsupported claims.
- Provide a consolidated record of limitations, defects and follow-up validation required.

## 4. Validation Approach

| Activity | Method used in supplied evidence |
|---|---|
| Functional UI validation | Manual interaction with local OIPP pages and screenshots of forms, validation messages, workflow states and results. |
| Database validation | MySQL schema/table inspection and targeted queries for recruiter request/application/password-hash records. |
| API / service validation | Local health and readiness endpoint checks. |
| Automated validation | Targeted server/security tests and full project test-suite result as stated in Thejus report. |
| Performance validation | Local benchmark using 2,000 listings, 10 concurrent users and 200 requests per endpoint. |
| Availability validation | Short local readiness-monitoring run with 12 checks. |
| Security validation | Bcrypt implementation/checks, authorization and log-redaction tests, HTTPS redirect/TLS checks, and specified JWT test procedures. |

## 5. Consolidated Validation Results

| Requirement ID | Validation area | Outcome | Evidence-based summary |
|---|---|---|---|
| OIPP-F-001 | Student registration and OTP | TESTED | Registration, OTP, invalid-domain and duplicate-email scenarios shown. |
| OIPP-F-002 | Student login | TESTED | Valid login, incorrect password and unregistered email scenarios shown. |
| OIPP-F-003 | Account lockout | TESTED | Lockout after five wrong passwords shown; lockout recovery not evidenced. |
| F-004 | Student profile | TESTED | Fields, CGPA validation and save feedback shown; persistence after fresh session is limited. |
| F-005 | Resume upload | TESTED | File selection/upload completion recorded; do not confuse with generated PDF download. |
| F-006 | PDF resume generation | TESTED | Save dialog and generated PDF opened with profile information. |
| F-007 | Browse open listings | TESTED | Local UI shows open opportunities using demo fixture data. |
| F-008 | Filter listings | TESTED | Combined role/location/CGPA filters returned two fixture listings; automated suite stated passed 124/124. |
| F-012 | Timed mock test | TESTED | Countdown, submission confirmation and 10/10 result captured. |
| F-013 | Score history | TESTED | Attempt appears with 10/10 and 100%. |
| F-016 | Recruiter listing management | TESTED | Local UI shows listing creation, OPEN and DRAFT states; fixture-based UI. |
| F-017 | Review applicants | TESTED | Applicant panel and shortlist/reject controls shown using fixtures. |
| F-018 | Admin recruiter approval/rejection | TESTED | SQL state changes and rejected-user access message shown. |
| F-019 | Admin placement summary | TESTED | Initial zero state and branch-filter result shown; date/combined filters and offer workflow incomplete. |
| F-020 | Recruiter account request | TESTED | Request form and pending status tested; incorrect displayed request time observed. |
| NF-001 | Performance | TESTED | Slowest reported p90 is 111 ms; 0 errors in measured benchmark. |
| NF-002 | Availability | TESTED | 12 checks, 0 failures; not a production availability claim. |
| NF-005 | Accessibility | TESTED | Visible keyboard focus and Tab navigation captured; broader accessibility coverage not demonstrated. |
| SR-001 | HTTPS enforcement | TESTED | HTTP redirect/TLS 1.3 tested with temporary self-signed certificate; deployment not included. |
| SR-003 / NF-003 | Password and personal-data security | TESTED | Bcrypt, authorization and log-redaction checks reported passed; database transport encryption excluded. |
| OIPP-SR-005 | JWT token security | TESTED | Valid, missing, malformed, tampered and expired token scenarios listed, but no execution responses supplied. |

## 7. Detailed Requirement Validation

### 7.1 Student registration, OTP, login and account lockout

**OIPP-F-001:** The RTM evidence guide describes a valid institutional-email registration, OTP delivery and verification, rejection of a non-college email, and duplicate-email validation. The screenshots are retained in the RTM evidence appendix. The evidence supports the scenarios described, but no separate OTP-expiry execution is documented.

**OIPP-F-002:** The supplied screenshots show successful sign-in and navigation to the student profile, an invalid-credentials response for an incorrect password, and an unsuccessful attempt using an unregistered email.

**OIPP-F-003:** The supplied screenshot records the account being locked after five incorrect password attempts. The guide describes continued blocking during the lockout period as expected behaviour, but does not provide a distinct test result for correct-password attempts during lockout or recovery after expiry.

### 7.2 Student profile, resume and PDF generation

**F-004:** The profile form, editing state, CGPA maximum validation (a value greater than 10 is rejected), valid CGPA save feedback and skills save feedback are captured. The source report explicitly notes that full persistence evidence is limited. A fresh-session/re-login check should be added before claiming persistence is fully validated.

**F-005:** The test summary records file selection/upload completion. The evidence set includes the resume upload control with a selected filename. This is separate from the generated PDF flow.

**F-006:** The save dialog and opened student-resume.pdf demonstrate PDF generation/download and that the generated PDF displays profile information. These screenshots must not be used as the sole proof of upload.

### 7.3 Mock test, score history and accessibility

**F-012:** The timed mock-test start/active screen shows a countdown and question progress; a submission confirmation prompt is captured. The report records a score of 10/10.

**F-013:** The score-history screen shows attempt #1 with a score of 10/10 and 100%.

**NF-005:** The supplied keyboard-navigation screenshot shows visible focus moving through profile controls. This is useful evidence of keyboard focus and Tab navigation, but it does not establish full accessibility conformance. Screen-reader, contrast, labels, error announcements and broader keyboard paths are not evidenced.

### 7.4 Opportunity browsing, filters and recruiter workflows

**F-007:** The local student listing page displays open opportunities with company, location, role type and minimum CGPA. The source explicitly states that this screenshot uses demo API fixture data.

**F-008:** Applying role “Intern”, location “Bengaluru” and minimum CGPA 7.5 returned two matching fixture cards: Frontend Developer Intern at Northstar Labs and Data Analyst Intern at Cedar Analytics. Automated tests are reported to cover individual/combined filters, empty filters and input validation.

**F-016:** The recruiter workspace shows a listing creation form and OPEN/DRAFT listing states. The source describes fixture-backed UI and targeted server tests for authorized creation, validation and status updates.

**F-017:** The applicant panel displays applicant details, resume filenames and shortlist/reject actions. The UI evidence uses demo applicant fixtures; targeted tests are stated to cover ownership rules, allowed decisions and protected terminal statuses.

**F-020:** The recruiter access-request form is shown. The Thejus report says automated checks confirm PENDING status, omission of password/hash from the response and no recruiter privileges before approval. The RTM evidence separately records a pending database status and an incorrect displayed request time; the timestamp issue remains a defect.

### 7.5 Administrative workflows and placement summary

**OIPP-F-018:** Admin can view pending recruiter requests and approve or reject them. SQL evidence shows an APPROVED status for an approved request and a REJECTED status for test.recruiter@example.com. The rejected recruiter sign-in displays an approval-required message rather than granting access.

**OIPP-F-019:** The unfiltered summary initially displayed 0 applications, 0 offers and 0.00% while the applications table contained no records. Test data was then created through an OPEN listing and student applications. The BTech Computer Science branch filter is shown returning two applications. The source warns that date and combined filters need complete recording. It also explains that Selected is used as an offer-count proxy because there is no separate offers table, but the shown recruiter interface has Shortlist and Reject actions; the Selected/offer calculation is not fully exercised.

### 7.6 Performance, availability and security

**NF-001:** The local benchmark used 2,000 listings, 10 concurrent users and 200 requests per endpoint. All eight measured endpoints recorded zero errors. Reported p90 values include 35.3 ms for page load, 6.7 ms for readiness, 111 ms for all active listings, 79/24.3/107/20.7 ms for role/location/minimum-CGPA/combined filters, and 5.7 ms for student applications. The slowest reported p90 is 111 ms, below the 3,000 ms threshold. Login and OTP email delivery were not measured.

**NF-002:** The local readiness monitor recorded 12 checks, zero failures and 100% availability. A fresh readiness check returned HTTP 200 with status ok and database up. This is a short local observation only.

**SR-001:** Local HTTP enforcement redirected GET to HTTPS; POST was rejected rather than redirected; trusted-proxy and Host handling tests passed; localhost HTTPS returned HTTP 200 over TLS 1.3 using a temporary self-signed certificate. Production deployment and certificate trust were not tested.

**SR-003 / NF-003:** Evidence includes the students.password_hash column, an aggregate query showing one account with a bcrypt-format 60-character hash without exposing the hash value, and source-code checks for bcrypt.hash during registration and bcrypt.compare during login. The Thejus report states that password hashing, personal-data authorization and log-redaction checks passed (23 targeted security tests; full suite 124 passed, 0 failed on 11 November). Database transport encryption is explicitly excluded.

**OIPP-SR-005:** The RTM document lists valid, missing, malformed, tampered and expired JWT scenarios and their expected outcomes, but explicitly states that execution screenshots/API responses are absent. These tests remain NOT EVIDENCED and must not be marked passed.

---

## Appendix A. Evidence

The following page images preserve the screenshots and visual evidence from the original PDF appendix. Each image corresponds to the same numbered page in the source PDF.


### Evidence appendix — PDF page 05

![Evidence from PDF page 05](Validation_Report_assets/page-05.png)

### Evidence appendix — PDF page 06

![Evidence from PDF page 06](Validation_Report_assets/page-06.png)

### Evidence appendix — PDF page 07

![Evidence from PDF page 07](Validation_Report_assets/page-07.png)

### Evidence appendix — PDF page 08

![Evidence from PDF page 08](Validation_Report_assets/page-08.png)

### Evidence appendix — PDF page 09

![Evidence from PDF page 09](Validation_Report_assets/page-09.png)

### Evidence appendix — PDF page 10

![Evidence from PDF page 10](Validation_Report_assets/page-10.png)

### Evidence appendix — PDF page 11

![Evidence from PDF page 11](Validation_Report_assets/page-11.png)

### Evidence appendix — PDF page 12

![Evidence from PDF page 12](Validation_Report_assets/page-12.png)

### Evidence appendix — PDF page 13

![Evidence from PDF page 13](Validation_Report_assets/page-13.png)

### Evidence appendix — PDF page 14

![Evidence from PDF page 14](Validation_Report_assets/page-14.png)

### Evidence appendix — PDF page 15

![Evidence from PDF page 15](Validation_Report_assets/page-15.png)

### Evidence appendix — PDF page 16

![Evidence from PDF page 16](Validation_Report_assets/page-16.png)

### Evidence appendix — PDF page 17

![Evidence from PDF page 17](Validation_Report_assets/page-17.png)

### Evidence appendix — PDF page 18

![Evidence from PDF page 18](Validation_Report_assets/page-18.png)

### Evidence appendix — PDF page 19

![Evidence from PDF page 19](Validation_Report_assets/page-19.png)

### Evidence appendix — PDF page 20

![Evidence from PDF page 20](Validation_Report_assets/page-20.png)

### Evidence appendix — PDF page 21

![Evidence from PDF page 21](Validation_Report_assets/page-21.png)

### Evidence appendix — PDF page 22

![Evidence from PDF page 22](Validation_Report_assets/page-22.png)

### Evidence appendix — PDF page 23

![Evidence from PDF page 23](Validation_Report_assets/page-23.png)

### Evidence appendix — PDF page 24

![Evidence from PDF page 24](Validation_Report_assets/page-24.png)

### Evidence appendix — PDF page 25

![Evidence from PDF page 25](Validation_Report_assets/page-25.png)

### Evidence appendix — PDF page 26

![Evidence from PDF page 26](Validation_Report_assets/page-26.png)

### Evidence appendix — PDF page 27

![Evidence from PDF page 27](Validation_Report_assets/page-27.png)

### Evidence appendix — PDF page 28

![Evidence from PDF page 28](Validation_Report_assets/page-28.png)

### Evidence appendix — PDF page 29

![Evidence from PDF page 29](Validation_Report_assets/page-29.png)

### Evidence appendix — PDF page 30

![Evidence from PDF page 30](Validation_Report_assets/page-30.png)

### Evidence appendix — PDF page 31

![Evidence from PDF page 31](Validation_Report_assets/page-31.png)

### Evidence appendix — PDF page 32

![Evidence from PDF page 32](Validation_Report_assets/page-32.png)

### Evidence appendix — PDF page 33

![Evidence from PDF page 33](Validation_Report_assets/page-33.png)

### Evidence appendix — PDF page 34

![Evidence from PDF page 34](Validation_Report_assets/page-34.png)

### Evidence appendix — PDF page 35

![Evidence from PDF page 35](Validation_Report_assets/page-35.png)

### Evidence appendix — PDF page 36

![Evidence from PDF page 36](Validation_Report_assets/page-36.png)
