# E.6.1N — Infrastructure Authoritative Evidence Request Package

## Phase
E.6.1N — READ_ONLY / EVIDENCE_COLLECTION_ONLY

## Safety status
- Production mutation: 0
- Production recovery: NOT_EXECUTED
- Historical recovery gate: FINAL_HOLD
- Human approval: NOT_APPROVED
- mutation_authorized: false
- E.6.2: NOT_PERMITTED

## Candidate
- record_id: 97b76766-d13a-4db6-8baf-572292b83913
- account_id: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- classification: LIKELY_CORRUPTED
- confidence: HIGH
- transaction timestamp (UTC): 2026-08-11T14:08:31.606Z
- endpoint: POST /api/v1/transactions
- stored amount: 100000000 cents
- potential intended amount: 1000000 cents
- opening balance: 1000000 cents
- currency: IDR
- transaction type: INCOME

## Known context from repository evidence
The repository contains database context and prior review artifacts, but no authoritative request-payload evidence proving the exact amount submitted by the client for this exact transaction.

Known values:
- record_id: 97b76766-d13a-4db6-8baf-572292b83913
- account_id: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- created_at: 2026-08-11T14:08:31.606Z
- stored amount: 100000000 cents
- potential intended amount: 1000000 cents
- opening balance: 1000000 cents
- endpoint: POST /api/v1/transactions
- request_id: UNKNOWN / UNAVAILABLE
- correlation_id: UNKNOWN / UNAVAILABLE
- trace_id: UNKNOWN / UNAVAILABLE

## Request to Infra / Logging
Please retrieve preserved, authoritative evidence for the exact request that created the candidate transaction.

### Investigation target
Determine whether the original client request for the candidate transaction contained:
- amount_cents = 1000000

This must be established for the exact candidate and account, not inferred from database state alone.

### Search window
- primary: 2026-08-11T14:00:00Z to 2026-08-11T14:15:00Z
- fallback: 2026-08-11T13:30:00Z to 2026-08-11T14:45:00Z

### Search terms
- 97b76766-d13a-4db6-8baf-572292b83913
- e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- 2026-08-11T14:08:31.606Z
- POST /api/v1/transactions
- amount_cents
- 1000000
- 100000000
- correlation id
- request id
- trace id

## Acceptable authoritative sources
Priority order:
1. Original API request payload from centralized/archived logging
2. API gateway or reverse proxy request capture containing the original payload or sufficient metadata to identify the exact request
3. Distributed tracing span or telemetry showing request attributes/body metadata
4. WAF/API gateway or ingress logs with request correlation IDs and relevant metadata
5. Independently preserved application telemetry or import/audit source proving the submitted amount
6. Other authoritative source that proves the exact request amount without relying on DB state alone

## Evidence types
- AUTHORITATIVE_DIRECT_REQUEST_PAYLOAD
- AUTHORITATIVE_INDEPENDENT_EVIDENCE
- DATABASE_DERIVED_CONTEXT
- APPLICATION_DERIVED_CONTEXT
- INSUFFICIENT_EVIDENCE

Important: database-derived context alone is not authoritative proof of the original client submission.

## Required evidence fields
Request, where legally/privacy/security permissible:
- source_system
- source_artifact
- event_timestamp
- request_timestamp
- endpoint
- HTTP method
- correlation_id
- request_id
- trace_id
- authenticated user or account identifier
- record_id
- account_id
- transaction type
- currency
- submitted amount_cents
- response status
- response timestamp
- relevant request metadata
- evidence retention/reference ID
- evidence hash if available

Do not request passwords, access tokens, refresh tokens, cookies, authorization headers, secrets, or unrelated PII.

If the original payload contains sensitive data, provide a redacted extract that preserves the fields necessary to establish the submitted amount and request identity.

## Exact match requirement
Evidence is sufficient only if it can reliably connect the submitted amount to:
- the exact candidate record_id
- the correct account_id
- the correct endpoint and request
- the correct transaction timestamp or a tightly bounded and independently corroborated window

The evidence must determine whether:
- submitted amount_cents == 1000000

Do not accept a generic log line that cannot be uniquely tied to the candidate.

## Outcome definitions
- A. AUTHORITATIVE_MATCH — direct proof that the submitted amount was 1000000 for the exact candidate
- B. AUTHORITATIVE_NON_MATCH — direct proof that the submitted amount was something else
- C. INDEPENDENT_CORROBORATION — authoritative independent source proves the amount without direct payload access
- D. INSUFFICIENT — evidence exists but cannot uniquely establish the submitted amount
- E. UNAVAILABLE — infrastructure cannot retrieve the evidence

## Human approval package requirements
If evidence is later obtained, an authorized reviewer must record:
- candidate record_id
- evidence classification
- evidence references
- submitted amount
- stored amount
- proposed correction
- exact mismatch determination
- reviewer
- reviewer_id
- review_timestamp
- decision
- approval_rationale
- rejection_rationale
- mutation_authorized

Default until evidence and human review exist:
- decision: PENDING_HUMAN_REVIEW
- approval_status: NOT_APPROVED
- mutation_authorized: false

## Final gate
E.6.2 remains NOT_PERMITTED unless BOTH conditions are satisfied:
1. authoritative request-payload or equivalent independent evidence proves the exact submitted amount for the exact candidate;
2. an authorized human reviewer explicitly approves the exact candidate with reviewer identity, rationale, timestamp, and mutation_authorized=true.

Technical staging PASS does not satisfy either condition.

## Next action
Wait for Infra / Logging to provide preserved authoritative evidence for the exact transaction. Do not infer the request amount from database state alone. Preserve the final hold and keep production mutation at 0.
