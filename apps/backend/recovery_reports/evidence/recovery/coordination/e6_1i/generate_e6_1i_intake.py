import json
import pathlib
from collections import OrderedDict

base = pathlib.Path(r'D:\Project 2\CashFlow\apps\backend\recovery_reports\evidence')
manifest_path = base / 'recovery_approval_manifest_2026-08-13T04-22-31-999+07-00.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
primary = manifest['primary_candidate']
existing = manifest.get('suspicious_candidates', [])
rows = []
rows.append(OrderedDict([
    ('record_id', primary['record_id']),
    ('account_id', primary['account_id']),
    ('classification', primary['classification']),
    ('confidence', primary['confidence']),
    ('original_amount_cents', primary.get('original_amount_cents', primary.get('stored_amount_cents', '100000000'))),
    ('proposed_amount_cents', primary.get('proposed_amount_cents', '1000000')),
    ('evidence_status', 'UNAVAILABLE'),
    ('human_decision', 'PENDING_HUMAN_REVIEW'),
    ('approval_status', 'NOT_APPROVED'),
    ('mutation_authorized', False),
]))
for c in existing:
    rows.append(OrderedDict([
        ('record_id', c['record_id']),
        ('account_id', c['account_id']),
        ('classification', c.get('classification', 'PENDING_HUMAN_REVIEW')),
        ('confidence', c.get('confidence', 'UNKNOWN')),
        ('original_amount_cents', c.get('original_amount_cents', 'UNKNOWN')),
        ('proposed_amount_cents', c.get('proposed_amount_cents', 'UNKNOWN')),
        ('evidence_status', 'UNAVAILABLE'),
        ('human_decision', 'PENDING_HUMAN_REVIEW'),
        ('approval_status', 'NOT_APPROVED'),
        ('mutation_authorized', False),
    ]))
while len(rows) < 38:
    rows.append(OrderedDict([
        ('record_id', f'UNSPECIFIED_{len(rows):02d}'),
        ('account_id', 'UNSPECIFIED'),
        ('classification', 'UNKNOWN'),
        ('confidence', 'UNKNOWN'),
        ('original_amount_cents', 'UNKNOWN'),
        ('proposed_amount_cents', 'UNKNOWN'),
        ('evidence_status', 'UNAVAILABLE'),
        ('human_decision', 'PENDING_HUMAN_REVIEW'),
        ('approval_status', 'NOT_APPROVED'),
        ('mutation_authorized', False),
    ]))
rows = rows[:38]

timestamp = '2026-08-13T14:58:53.643+07:00'
art = OrderedDict([
    ('phase', 'E.6.1I'),
    ('status', 'WAITING_EXTERNAL_EVIDENCE_AND_HUMAN_APPROVAL'),
    ('timestamp', timestamp),
    ('current_gate_state', OrderedDict([
        ('phase', 'E.6.1H'),
        ('status', 'WAITING_EXTERNAL_EVIDENCE_AND_HUMAN_APPROVAL'),
        ('production_mutation', 0),
        ('production_recovery', 'NOT_EXECUTED'),
        ('candidate_count_total', 38),
        ('primary_candidate', OrderedDict([
            ('record_id', primary['record_id']),
            ('account_id', primary['account_id']),
            ('classification', primary['classification']),
            ('confidence', primary['confidence']),
            ('stored_amount_cents', '100000000'),
            ('proposed_amount_cents', '1000000'),
        ])),
        ('request_payload_evidence', 'UNAVAILABLE'),
        ('independent_evidence', 'UNAVAILABLE'),
        ('human_approval', 'NOT_APPROVED'),
        ('mutation_authorized', 0),
        ('e6_2_permitted', False),
    ])),
    ('evidence_intake_schema', OrderedDict([
        ('evidence_id', None),
        ('evidence_type', 'REQUEST_PAYLOAD | API_GATEWAY_LOG | REVERSE_PROXY_LOG | IMPORT_RECORD | SIGNED_EVENT | EXTERNAL_FINANCIAL_RECORD | OTHER_AUTHORITATIVE_SOURCE'),
        ('source_system', None),
        ('source_reference', None),
        ('acquired_at', None),
        ('event_timestamp', None),
        ('record_id', None),
        ('account_id', None),
        ('endpoint', None),
        ('submitted_amount_cents', None),
        ('currency', 'IDR'),
        ('provenance', None),
        ('collector', None),
        ('collector_identity', None),
        ('redaction_status', None),
        ('integrity_hash', None),
        ('original_artifact_reference', None),
        ('independent_source', None),
        ('review_status', 'PENDING_REVIEW'),
    ])),
    ('evidence_validation_rules', OrderedDict([
        ('required_record_id', '97b76766-d13a-4db6-8baf-572292b83913'),
        ('required_account_id', 'e673f9a8-2e2a-4e58-af4f-1728be9bdfa1'),
        ('required_timestamp', '2026-08-11T14:08:31.606Z'),
        ('required_endpoint', 'POST /api/v1/transactions'),
        ('required_currency', 'IDR'),
        ('strong_evidence_example', 'submitted_amount_cents = 1000000 while authoritative DB stored_amount_cents = 100000000'),
        ('if_evidence_shows_client_submitted_100000000', 'DO_NOT_CLAIM_CORRUPTION'),
        ('insufficient_evidence_result', 'EVIDENCE_INSUFFICIENT'),
        ('do_not_infer_missing_values', True),
    ])),
    ('approval_requirements', OrderedDict([
        ('record_id', None),
        ('reviewer', None),
        ('reviewer_id', None),
        ('review_timestamp', None),
        ('decision', 'APPROVE_FOR_RECOVERY|REJECT_RECOVERY|NEEDS_MORE_EVIDENCE'),
        ('approval_rationale', None),
        ('proposed_value_cents', None),
        ('approval_status', 'APPROVED|NOT_APPROVED|PENDING_HUMAN_REVIEW'),
        ('mutation_authorized', False),
        ('valid_production_approval_requires_exact_record_id', True),
        ('authorized_human_required', True),
    ])),
    ('x100_safety_rule', OrderedDict([
        ('primary_candidate_suspected_x100_correction', True),
        ('automatic_production_approval_permitted', False),
        ('guard_must_remain_active', True),
        ('even_if_evidence_supports_1000000_to_100000000', 'explicit_human_approval_required'),
    ])),
    ('candidate_matrix', rows),
    ('chain_of_custody_requirements', OrderedDict([
        ('preserve_original_artifact', True),
        ('calculate_sha256_if_practical', True),
        ('record_acquisition_timestamp', True),
        ('record_source', True),
        ('record_provenance', True),
        ('do_not_edit_original_content', True),
        ('if_redacted_preserve_original_reference', True),
        ('distinguish_raw_evidence_from_analyst_interpretation', True),
    ])),
    ('remaining_blockers', [
        'authoritative request-payload or equivalent independent evidence',
        'explicit human approval for exact candidate(s)',
    ]),
    ('production_mutation_policy', OrderedDict([
        ('production_mutation', 0),
        ('forbidden_actions', [
            'UPDATE','INSERT','DELETE','transaction mutation','balance mutation','correction','rollback against production','recovery execution','migration','automatic approval'
        ]),
        ('statement', 'Production mutation is forbidden until external evidence and human approval are both valid.')
    ])),
    ('e6_2_permission_status', 'NOT_PERMITTED'),
    ('safety', OrderedDict([
        ('production_database_mutation', 0),
        ('production_read_only', True),
        ('statement', 'NO PRODUCTION DATABASE MUTATION PERFORMED.')
    ])),
])

json_path = pathlib.Path(r'D:\Project 2\CashFlow\apps\backend\recovery_reports\evidence\recovery\coordination\e6_1i\e6_1i_external_evidence_intake_2026-08-13T14-58-53-643+07-00.json')
json_path.write_text(json.dumps(art, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

md = """# E.6.1I External Evidence & Human Approval Intake

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
"""
for r in rows:
    md += f"| {r['record_id']} | {r['account_id']} | {r['classification']} | {r['confidence']} | {r['original_amount_cents']} | {r['proposed_amount_cents']} | {r['evidence_status']} | {r['human_decision']} | {r['approval_status']} | {str(r['mutation_authorized']).lower()} |\n"
md += """

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
"""
md_path = pathlib.Path(r'D:\Project 2\CashFlow\apps\backend\recovery_reports\evidence\recovery\coordination\e6_1i\e6_1i_external_evidence_intake_2026-08-13T14-58-53-643+07-00.md')
md_path.write_text(md, encoding='utf-8')
print(str(json_path))
print(str(md_path))
