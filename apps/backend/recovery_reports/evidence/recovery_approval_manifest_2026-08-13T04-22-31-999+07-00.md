Recovery Approval Manifest — Phase E.5.6 (READ_ONLY)

Generated: 2026-08-13T04:22:31.999+07:00
Database mutations performed: 0

Executive summary

This manifest prepares human reviewers to inspect the recovery candidates identified by the scanner. It is a documentation-only artifact and does NOT approve any corrections. NO CANDIDATE IS CURRENTLY APPROVED. Phase E.6 remains BLOCKED.

Primary candidate (do NOT modify)
- record_id: 97b76766-d13a-4db6-8baf-572292b83913
- account_id: e673f9a8-2e2a-4e58-af4f-1728be9bdfa1
- currency: IDR
- transaction_type: INCOME
- created_at: 2026-08-11T14:08:31.606Z
- stored amount_cents: 100000000
- proposed amount_cents: 1000000
- correction ratio: 0.01
- classification: LIKELY_CORRUPTED
- confidence: HIGH
- current decision: PENDING_HUMAN_REVIEW
- approval_status: NOT_APPROVED
- mutation_authorized: false

Evidence references
- apps/backend/recovery_reports/dry_run/dry_run_report_2026-08-12T20-05-52-501Z.json
- apps/backend/recovery_reports/review_full.json
- apps/backend/recovery_reports/evidence/db_context_2026-08-12T21-00-50-843Z.json
- apps/backend/recovery_reports/evidence/evidence_verification_2026-08-13T03-59-12-901+07-00_db_verified.json
- apps/backend/recovery_reports/evidence/evidence_verification_2026-08-13T04-04-15-705+07-00_request_logs.json
- apps/backend/recovery_reports/evidence/recovery_decision_package_2026-08-13T04-16-39-066+07-00.json
- apps/backend/recovery_reports/evidence/infra_request_phase_e5_5_2026-08-13T04-20-27-531+07-00.json

Missing evidence
- Direct client request payload (amount_cents) from centralized logs or gateway archives
- External authoritative source (payment gateway/import) showing original amount, if any

Reviewer placeholders (to be filled by human reviewer)
- reviewer: <name/email>
- reviewer_notes: <notes>
- approval_timestamp: <ISO timestamp>
- approval_reference: <ticket/manifest id>

Suspicious candidates (summary)
Total suspicious candidates included from review_full.json: 37
All are set to decision = PENDING_HUMAN_REVIEW, approval_status = NOT_APPROVED, mutation_authorized = false.

(Full list with IDs and basic fields included in the JSON manifest file.)

Approval decisions allowed
- APPROVE_CORRECTION
- REJECT_CORRECTION
- NEEDS_MORE_EVIDENCE

Approval requirements (must be met for APPROVE_CORRECTION)
- reviewer identity recorded and explicit approval of record_id
- original value recorded
- proposed value recorded
- evidence references recorded
- reason documented
- reviewer confirms correction is intentional
- rollback plan exists
- idempotency plan exists
- audit trail requirements satisfied
- pre-mutation verification passes
- no conflicting evidence exists

Mandatory rejection conditions
- request evidence contradicts the proposed correction
- original/proposed values cannot be independently established
- evidence is ambiguous
- candidate is not the correct account/transaction
- correction would alter a legitimate transaction
- reviewer cannot establish intended value
- duplicate/retry semantics are unclear
- another authoritative source contradicts the correction

Immutable pre-mutation snapshot requirements (to be captured at mutation time, NOT now)
- record_id
- account_id
- original_amount_cents
- proposed_amount_cents
- transaction_type
- currency
- created_at
- updated_at
- current_account_balance
- opening_balance
- evidence hashes/references

Idempotency guardrails (design-only)
- refuse to run if record is no longer in expected original state
- refuse if amount_cents changed since approval
- refuse if account changed
- refuse if candidate already corrected
- refuse if approval manifest does not match exact record/value
- refuse if approval expired or revoked

Audit requirements (design-only)
- record reviewer
- record approval timestamp
- record record_id and account_id
- record original value and new value
- record reason and evidence references
- operation ID
- before/after values
- execution timestamp
- rollback reference

Phase E.6 gate (strict)
Phase E.6 remains BLOCKED. It may start only when all of the following are true:
- human approval exists and is recorded in approval_manifest
- approval manifest explicitly authorizes exact candidate(s)
- infra evidence has been reviewed or authorized human confirms evidence
- original value still matches
- proposed value still matches
- pre-mutation verification passes
- rollback strategy exists
- idempotency strategy exists
- audit strategy exists

Safety statement
This manifest is READ_ONLY. NO CANDIDATE IS CURRENTLY APPROVED. Do not run any DB mutation or implement correction logic based on this manifest alone.

Paths
- JSON manifest: apps/backend/recovery_reports/evidence/recovery_approval_manifest_2026-08-13T04-22-31-999+07-00.json
- Markdown summary: apps/backend/recovery_reports/evidence/recovery_approval_manifest_2026-08-13T04-22-31-999+07-00.md

Prepared by: recovery scanner (read-only)

If you need a pre-filled approval template per-candidate (for reviewers to sign and attach), say "Prepare approval template" and indicate which candidate(s) to pre-fill.