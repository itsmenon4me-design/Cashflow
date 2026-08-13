# Transaction Observability Improvement Proposal (Read-Only)

This proposal is intentionally documentation-only. It does not change runtime behavior or production data access.

## Current observation

The current request logging path records request method, URL, IP, User-Agent, and a generated correlation ID, as implemented in the logger middleware. The audit interceptor records request metadata only for routes annotated with @Audit. The transaction creation request is not automatically audited in way that captures the submitted payload. This creates a gap for post-incident reconstruction and for proving the original submitted amount for a candidate transaction.

## Proposed improvements

1. correlation/request ID propagation
   - require x-correlation-id propagation from ingress to application to all downstream logs
   - preserve mapping across proxy, API gateway, app logs, and centralized exports
2. safe transaction request metadata logging
   - record timestamp, route, account_id, transaction type, actor identity, and request metadata without logging raw secrets or full payload bodies unless explicitly allowed by policy
3. amount_cents observability with privacy controls
   - store a structured amount summary (currency, cents, and source) in a secure audit stream with access controls and retention requirements
4. structured request/response audit records
   - log the request lifecycle for transaction creation with status, result, correlation ID, and summarized metadata
5. centralized log retention
   - retain request metadata and gateway/export records in an immutable central archive with clear retention and access controls
6. gateway/proxy correlation
   - correlate proxy ingress IDs with app correlation IDs to map client requests to server-side DB writes
7. anomaly detection for ×100/÷100
   - alert on exact 100x and 1/100 anomalies when they appear alongside account-balance drift or suspicious request metadata
8. ledger reconciliation
   - capture deterministic reconciliation logs showing transaction delta and posting delta for each event
9. immutable audit trail
   - store incident evidence artifacts with checksum/manifest records to support later review
10. incident recovery evidence requirements
   - require authoritative request evidence and explicit human approval before any production recovery path is allowed

## Relevant implementation references

- apps/backend/src/common/logger/logger.middleware.ts
- apps/backend/src/common/audit/audit.interceptor.ts
- apps/backend/src/common/audit/audit.decorator.ts

## Safety note

This document is a proposal only. It does not change implementation, production configuration, or recovery behavior.
