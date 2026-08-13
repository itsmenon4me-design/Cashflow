# E.6.1I External Evidence & Human Approval Intake

Phase: E.6.1I
Status: WAITING_EXTERNAL_EVIDENCE_AND_HUMAN_APPROVAL
Timestamp: 2026-08-13T14:58:53.643+07:00

## Current Gate State

- Phase: E.6.1H
- Status: WAITING_EXTERNAL_EVIDENCE_AND_HUMAN_APPROVAL
- Production mutation: 0
- Production recovery: NOT_EXECUTED
- Candidate count: 38
- Primary candidate: 97b76766-d13a-4db6-8baf-572292b83913
- Account: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- Classification: LIKELY_CORRUPTED
- Confidence: HIGH
- Request payload evidence: UNAVAILABLE
- Independent evidence: UNAVAILABLE
- Human approval: NOT_APPROVED
- mutation_authorized: 0
- E.6.2: NOT_PERMITTED

## Evidence Intake Schema

Required fields for any supplied evidence:

- evidence_id
- evidence_type
- source_system
- source_reference
- acquired_at
- event_timestamp
- record_id
- account_id
- endpoint
- submitted_amount_cents
- currency
- provenance
- collector
- collector_identity
- redaction_status
- integrity_hash
- original_artifact_reference
- independent_source
- review_status

Allowed values for evidence_type:

- REQUEST_PAYLOAD
- API_GATEWAY_LOG
- REVERSE_PROXY_LOG
- IMPORT_RECORD
- SIGNED_EVENT
- EXTERNAL_FINANCIAL_RECORD
- OTHER_AUTHORITATIVE_SOURCE

## Evidence Validation Rules

For the primary candidate, evidence must match:

- record_id: 97b76766-d13a-4db6-8baf-572292b83913
- account_id: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- timestamp: 2026-08-11T14:08:31.606Z
- endpoint: POST /api/v1/transactions
- currency: IDR

The evidence must establish the intended or submitted amount.

If evidence shows the client submitted 100000000 while the DB stored 100000000, do not claim corruption.

If timestamp, record ID, account ID, or provenance cannot be established, mark EVIDENCE_INSUFFICIENT.

## Human Approval Intake

Required fields:

- record_id
- reviewer
- reviewer_id
- review_timestamp
- decision
- approval_rationale
- proposed_value_cents
- approval_status
- mutation_authorized

Valid decisions:

- APPROVE_FOR_RECOVERY
- REJECT_RECOVERY
- NEEDS_MORE_EVIDENCE

Production approval requires exact match to the candidate, explicit authorization, valid reviewer identity, and explicit mutation_authorized=true.

## ×100 Safety Rule

The primary candidate is a suspected ×100 correction. Automatic production approval is forbidden. The ×100 guard remains active even if external evidence suggests a 1,000,000-to-100,000,000 relationship.

## Candidate Intake Matrix

Initial values for all candidates remain read-only and blocked until external evidence and human approval are valid:

- evidence_status = UNAVAILABLE
- human_decision = PENDING_HUMAN_REVIEW
- approval_status = NOT_APPROVED
- mutation_authorized = false

## 38-Candidate Matrix

| record_id | account_id | classification | confidence | original_amount_cents | proposed_amount_cents | evidence_status | human_decision | approval_status | mutation_authorized |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 97b76766-d13a-4db6-8baf-572292b83913 | e673f9a8-2e2a-4e58-af4f-1728be9bdfa1 | LIKELY_CORRUPTED | HIGH | 100000000 | 1000000 | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 5881c75f-37d1-43f2-accc-f60b7334c08c | be28ddee-dbb8-4194-a5a9-226f90010409 | SUSPICIOUS | LOW | 175000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| d07bf0a0-49b3-4e35-a9aa-5b4c19b3806d | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 7500000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 9e297411-6fa5-4386-9b7c-9115bcd6b0df | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 2000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| c2e5bc10-3285-4cbd-a4ab-ea24f1f824e3 | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 1250000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 8f7a07ba-2305-4bf2-8720-74c51ab0550d | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 850000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 0627fa78-56f8-46af-aba5-51a877f753f7 | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 300000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| df829ef3-a6d7-495f-a76c-352ab46d5dd6 | 7b2b8bae-b261-4dcf-b3ac-52e8e651485d | SUSPICIOUS | LOW | 7500000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| ec51fedf-0c04-44d7-b308-3ce4cd2693e7 | 509306f3-2800-4f14-a496-8da5d6fa1f4e | SUSPICIOUS | LOW | 250000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 809c0d38-90cc-4588-95e7-ba5e0dfb1e4e | 509306f3-2800-4f14-a496-8da5d6fa1f4e | SUSPICIOUS | LOW | 90000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 810c9bcb-a477-4a60-9650-870b046492d2 | 509306f3-2800-4f14-a496-8da5d6fa1f4e | SUSPICIOUS | LOW | 15000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| de65b63f-32fd-468e-898e-b7a3f0857060 | a8226c46-dd98-4075-b796-bdf0d27b31ee | SUSPICIOUS | LOW | 90000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 9f68da60-5f9e-4bc8-b0ff-3043e44f1f43 | a8226c46-dd98-4075-b796-bdf0d27b31ee | SUSPICIOUS | LOW | 15000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 7826df9f-e59d-4cba-b08b-257f857a3088 | 67c0d683-9975-4fe2-810f-267e9c7d3a94 | SUSPICIOUS | LOW | 5000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 43a511a4-3f2c-48d0-8d22-5040b14991c9 | dab63b43-495e-4891-b460-45c4688fc106 | SUSPICIOUS | LOW | 250000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 891f7c02-4269-4618-87e4-0d8aa606a7a4 | dab63b43-495e-4891-b460-45c4688fc106 | SUSPICIOUS | LOW | 20000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 423d264d-789c-40fa-b0c5-07ec814e940e | dab63b43-495e-4891-b460-45c4688fc106 | SUSPICIOUS | LOW | 20000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| cc70a5a9-0804-4b35-8519-864c8d63e6e9 | dab63b43-495e-4891-b460-45c4688fc106 | SUSPICIOUS | LOW | 77700 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| befa1520-76fd-4301-b337-33c1124e89e4 | efec5eb5-dad6-41d7-b96d-ffb9cde4f1ea | SUSPICIOUS | LOW | 15000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| fbe3a142-75b4-4749-8d00-b07f67c8fbe2 | efec5eb5-dad6-41d7-b96d-ffb9cde4f1ea | SUSPICIOUS | LOW | 5000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| e5cf1d8a-e589-42ff-9ee9-07f3179cbc81 | 484f1e37-69e2-4ff5-a934-33def8419fe1 | SUSPICIOUS | LOW | 200000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 65dd2b6c-e973-4220-8aa0-65d2bd6573e9 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 100000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 0a69f955-cb55-4cba-9eee-f3f3466d4833 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 25100 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| fd819ee9-42ee-4ff9-b545-795f47a32b12 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 7300 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 762e8944-62f0-47e3-84d3-f99426796edc | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 5000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| f237b82b-f265-4cb6-b7a2-39366cc16148 | e673f9a8-2e2a-4e58-af4f-1728be9bdfa1 | SUSPICIOUS | LOW | 10000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| db0f3113-08bf-479c-8e0b-5451f02cf59d | e673f9a8-2e2a-4e58-af4f-1728be9bdfa1 | SUSPICIOUS | LOW | 25000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| d29041a7-326d-4451-b1d7-56a0e3472058 | 57366241-9107-4741-ae35-eddf1f2539ae | SUSPICIOUS | LOW | 70000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| bc3b5c9d-679b-4681-925e-ab0430994f99 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 1000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 55f2cca0-a1c6-49fc-aed7-2139e5e7cf00 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 90000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| b0aae28a-fad8-4540-b128-b974598da398 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 20000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| d2d7fb91-0372-4ea3-a0be-7cbde8120df0 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 90000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 7fa294da-80f6-4f56-9f66-092277b16e80 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 90000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 992b9cc8-dd69-4a99-b975-12c4e52639aa | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 1000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 418eccf2-6408-41af-95df-d4d2469d0593 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 10000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| f2705204-8ebb-4a49-bfae-1574dcffb841 | 16a3c96c-574c-4ca1-9db9-7de85300e4fc | SUSPICIOUS | LOW | 5000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| 8ce442b3-410e-423b-8a14-a16238f1bc64 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 1000000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |
| d0c31e40-53ef-45fb-bcae-155d60549ed6 | 8fd53ecd-aa10-4a00-977d-80540836ed2b | SUSPICIOUS | LOW | 100000000 | UNKNOWN | UNAVAILABLE | PENDING_HUMAN_REVIEW | NOT_APPROVED | false |


## Chain of Custody and Integrity

For every newly supplied artifact:

- preserve original artifact
- calculate SHA-256 where possible
- record acquisition timestamp
- record source
- record provenance
- do not edit original content
- if redacted, preserve the original reference or manifest
- distinguish raw evidence from analyst interpretation

## Remaining Blockers

- authoritative request-payload or equivalent independent evidence
- explicit human approval for exact candidate(s)

## Safety

Production mutation is forbidden until both external gates are satisfied.

NO PRODUCTION DATABASE MUTATION PERFORMED.

E.6.2 permission status: NOT_PERMITTED
