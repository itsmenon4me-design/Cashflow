# F.1 — Transaction Integrity & Observability Foundation

## Status

- Phase: F.1
- Result: COMPLETED
- Historical recovery case: FINAL_HOLD_WAITING_EXTERNAL_EVIDENCE
- Production mutation count: 0
- Production recovery: NOT_EXECUTED
- Historical recovery gate: FINAL_HOLD
- Human approval: NOT_APPROVED
- Request payload evidence: UNAVAILABLE
- E.6.2: NOT_PERMITTED

## Current transaction data flow

1. HTTP request reaches the authenticated transaction controller.
2. Controller validates DTO shape and passes the request trace context when headers are available.
3. Transaction service normalizes and validates the amount in minor units.
4. Validation service checks account/category validity and transaction rules.
5. Repository inserts or updates the transaction.
6. Account balance recalculation runs.
7. Audit log records request metadata, account context, and operation result.
8. Response is serialized back to the API client.

## Identified risks

- Integer-cent validation existed but did not explicitly fail closed for malformed decimal input before conversion.
- Request metadata existed in the logger layer, but the transaction creation/update path did not consistently carry correlation IDs into audit metadata.
- Scale anomalies such as exact 100x or 1/100 patterns were not surfaced as an explicit anomaly signal without mutating the record.

## Changes made

- Added safe integer-cent normalization in the transaction service.
- Rejected decimal or malformed monetary representations before persistence.
- Added request trace metadata propagation from request headers to transaction audit records.
- Added `AMOUNT_SCALE_ANOMALY` detection without automatic correction.
- Hardened finance bot evaluation to fail safely without aborting transaction creation.

## Security and privacy

- No secrets or authorization headers are stored in the trace metadata.
- Full request bodies are not logged by default.
- Transaction amounts remain in minor-unit integer form for auditability and privacy.

## Anomaly detection behavior

- When a candidate amount is exactly 100x or 1/100 of a nearby historical amount in the same account, the service emits an anomaly signal.
- The system does not modify the transaction or auto-correct balances.
- Any recovery remains gated behind evidence, human approval, and the existing recovery workflow.

## Audit behavior

The audit record now includes:

- userId
- entityId
- accountId
- transactionType
- amountCents
- correlationId
- requestId
- operation result
- anomalyCode

This gives a trace from request to transaction write to audit record.

## Correlation ID behavior

When the request includes `x-correlation-id` and/or `x-request-id`, the transaction controller passes those values into the service and audit metadata. No secrets or tokens are logged.

## Tests

Relevant tests were run and passed:

- transaction service validation and anomaly tests
- transaction controller request trace tests
- full transaction and audit related suite

Executed commands:

- `npm test -- --runInBand src/modules/transactions src/modules/audit-logs src/modules/audit` (exit code 0)
- `npx tsc --noEmit` (exit code 0)

## Final note

The historical recovery case remains under final hold and is not reopened by this phase. The work is intentionally preventive and read-only from a production perspective.
