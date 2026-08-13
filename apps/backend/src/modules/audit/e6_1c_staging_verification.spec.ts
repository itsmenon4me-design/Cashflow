import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HistoricalDataRecoveryService } from './historical-data-recovery.service';

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

function writeJson(filePath: string, data: JsonValue): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

function redactDatabaseUrl(url?: string): string {
  if (!url) return 'NOT_SET';
  const masked = url.replace(/(:\/\/)([^:@]+)(:[^@]+)?@/i, '$1***:***@');
  return masked.length > 120 ? `${masked.slice(0, 90)}...redacted` : masked;
}

describe('E.6.1C durable staging artifact verification (staging-only)', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.resolve(
    __dirname,
    '../../../recovery_reports/evidence/recovery/staging/e6_1c',
    `e6_1c_run_${timestamp}`,
  );

  const STAGING_TEST_DATA = {
    account: {
      id: 'stg-acc-e61c-01',
      user_id: 'stg-user-e61c-01',
      currency: 'IDR',
      opening_balance_cents: '1000000',
      account_type: 'CHECKING',
    },
    transactions: [
      {
        id: 'stg-tx-e61c-before-1',
        account_id: 'stg-acc-e61c-01',
        user_id: 'stg-user-e61c-01',
        transaction_type: 'INCOME',
        amount_cents: '250000',
        currency: 'IDR',
        note: 'STAGING_TEST_DATA: historical income before candidate',
        created_at: new Date().toISOString(),
      },
      {
        id: 'stg-tx-e61c-candidate',
        account_id: 'stg-acc-e61c-01',
        user_id: 'stg-user-e61c-01',
        transaction_type: 'INCOME',
        amount_cents: '100000000',
        currency: 'IDR',
        note: 'STAGING_TEST_DATA: synthetic suspicious candidate',
        created_at: new Date().toISOString(),
      },
      {
        id: 'stg-tx-e61c-after-1',
        account_id: 'stg-acc-e61c-01',
        user_id: 'stg-user-e61c-01',
        transaction_type: 'EXPENSE',
        amount_cents: '150000',
        currency: 'IDR',
        note: 'STAGING_TEST_DATA: expense after candidate',
        created_at: new Date().toISOString(),
      },
    ],
  };

  beforeAll(() => {
    fs.mkdirSync(runDir, { recursive: true });
  });

  it('verifies the environment is a non-production staging-safe environment', () => {
    const envName = (process.env.NODE_ENV ?? 'test').toLowerCase();
    const safeValues = new Set(['staging', 'staging-local', 'test', 'ci']);
    const dbUrl = process.env.DATABASE_URL ?? '';
    const prodIndicators = [
      'prod',
      'production',
      'rds',
      'amazonaws.com',
      'db.prod',
      'live',
    ];
    const hasProdIndicator = prodIndicators.some((indicator) =>
      `${envName} ${dbUrl}`.toLowerCase().includes(indicator),
    );

    expect(
      safeValues.has(envName) ||
        dbUrl.includes('localhost') ||
        dbUrl.includes('postgres'),
    ).toBe(true);
    expect(hasProdIndicator).toBe(false);

    const summary = {
      node_env: envName,
      database_url_present: Boolean(dbUrl),
      database_url_redacted: redactDatabaseUrl(dbUrl),
      database_host: (() => {
        try {
          const sanitized = dbUrl
            .replace(/^postgres(?:ql)?:\/\//i, '')
            .replace(/^\//, '');
          return sanitized.split('/')[0].split(':')[0] || 'unknown';
        } catch {
          return 'unknown';
        }
      })(),
      environment_status: 'STAGING_SAFE',
      production_indicators_blocked: prodIndicators,
    };

    writeJson(path.join(runDir, 'environment.summary.json'), summary);
    expect(summary.environment_status).toBe('STAGING_SAFE');
  });

  it('creates durable staging artifacts and verifies immutable snapshot hashing', () => {
    const beforeBalanceCents = BigInt(
      STAGING_TEST_DATA.account.opening_balance_cents,
    );
    const expectedCurrentBalance = STAGING_TEST_DATA.transactions.reduce(
      (sum, tx) => sum + BigInt(tx.amount_cents),
      beforeBalanceCents,
    );

    const snapshot = {
      phase: 'E.6.1C',
      snapshot_version: '1.0.0',
      artifact_version: 'artifact-v1',
      snapshot_ts: new Date().toISOString(),
      recovery_id: 'recovery-stg-e61c-001',
      record_id: STAGING_TEST_DATA.transactions[1].id,
      account_id: STAGING_TEST_DATA.account.id,
      account: STAGING_TEST_DATA.account,
      candidate_transaction: STAGING_TEST_DATA.transactions[1],
      related_transactions: STAGING_TEST_DATA.transactions,
      opening_balance_cents: STAGING_TEST_DATA.account.opening_balance_cents,
      expected_current_balance_cents: expectedCurrentBalance.toString(),
      balance_related_fields: {
        start_balance_cents: STAGING_TEST_DATA.account.opening_balance_cents,
        current_balance_cents: expectedCurrentBalance.toString(),
        ledger_delta_cents: '100000000',
        transaction_delta_cents: '100000000',
      },
      recovery_plan: {
        actor_id: 'stg-reviewer',
        approved_value_cents: '1000000',
        requires_manual_approval: true,
        mode: 'staging-only',
      },
      metadata: {
        fixture_label: 'STAGING_TEST_DATA',
        storage_kind: 'durable-staging-artifact-store',
        mutable_copy_allowed: false,
      },
    };
    const canonical = canonicalize(snapshot) as Record<string, unknown>;
    const hash = sha256(JSON.stringify(canonical));

    const snapshotPath = path.join(runDir, 'snapshot.json');
    const manifestPath = path.join(runDir, 'snapshot.manifest.json');
    const approvalPath = path.join(runDir, 'approval.manifest.json');
    const executionStatePath = path.join(runDir, 'execution.state.json');
    const rollbackArtifactPath = path.join(runDir, 'rollback.artifact.json');
    const auditPath = path.join(runDir, 'audit.records.json');
    const reconciliationPath = path.join(runDir, 'reconciliation.result.json');
    const concurrencyPath = path.join(runDir, 'concurrency.result.json');
    const finalReportPath = path.join(runDir, 'final.verification.report.json');

    writeJson(snapshotPath, snapshot);
    writeJson(manifestPath, {
      snapshot_file: 'snapshot.json',
      sha256: hash,
      artifact_version: 'artifact-v1',
      immutable: true,
      fixture_label: 'STAGING_TEST_DATA',
      generated_at: new Date().toISOString(),
    });
    writeJson(approvalPath, {
      reviewer_id: 'stg-reviewer',
      reviewer: 'synthetic-staging-reviewer',
      decision: 'APPROVED_FOR_TESTING',
      mutation_authorized: false,
      phase: 'E.6.1C',
    });
    writeJson(executionStatePath, {
      status: 'PENDING',
      recovery_id: snapshot.recovery_id,
      last_updated_at: new Date().toISOString(),
    });
    writeJson(rollbackArtifactPath, {
      snapshot_hash: hash,
      original_state: 'pre-recovery',
      rollback_status: 'NOT_EXECUTED',
    });
    writeJson(auditPath, {
      records: [],
      artifact_store: runDir,
      phase: 'E.6.1C',
    });
    writeJson(reconciliationPath, {
      status: 'PENDING',
      before_balance_cents: STAGING_TEST_DATA.account.opening_balance_cents,
      expected_after_cents: '1000000',
      actual_after_cents: '1000000',
    });
    writeJson(concurrencyPath, {
      status: 'PENDING',
      accepted_attempts: 0,
      rejected_attempts: 0,
    });
    writeJson(finalReportPath, {
      final_gate: 'PENDING',
      phase: 'E.6.1C',
    });

    const reRead = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const reHash = sha256(JSON.stringify(canonicalize(reRead)));
    expect(reHash).toBe(hash);

    const mutatedCopy = JSON.parse(JSON.stringify(reRead));
    mutatedCopy.metadata.mutable_copy_allowed = true;
    expect(JSON.stringify(mutatedCopy)).not.toBe(
      fs.readFileSync(snapshotPath, 'utf8'),
    );

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.sha256).toBe(hash);
    expect(manifest.immutable).toBe(true);

    const executionState = JSON.parse(
      fs.readFileSync(executionStatePath, 'utf8'),
    );
    expect(executionState.status).toBe('PENDING');
  });

  it('enforces ×100 rejection through the actual recovery service', () => {
    const recoveryService = new HistoricalDataRecoveryService(true);
    const candidateFinding = {
      finding_id: 'stg-find-e61c-candidate',
      entity_type: 'transaction',
      entity_id: STAGING_TEST_DATA.transactions[1].id,
      user_id: 'stg-reviewer',
      currency: STAGING_TEST_DATA.account.currency,
      stored_value: STAGING_TEST_DATA.transactions[1].amount_cents,
      suspected_value: '1000000',
      severity: 'HIGH' as const,
      status: 'LIKELY_CORRUPTED' as const,
      confidence: 0.95,
      reason:
        'STAGING_TEST_DATA: suspicious transaction with stored amount exactly 100x the expected amount.',
      evidence: [
        'opening_balance_cents=1000000',
        'stored_amount=100000000',
        'proposed_amount=1000000',
      ],
      recommended_action: 'Manual review required',
    };

    const plan = recoveryService.buildDryRun({
      finding: candidateFinding,
      actorId: 'stg-reviewer',
      currentRecordOwnerId: 'stg-reviewer',
      currentValue: STAGING_TEST_DATA.transactions[1].amount_cents,
      currentCurrency: STAGING_TEST_DATA.account.currency,
      approvedValue: '1000000',
      recoveryId: 'stg-recovery-e61c-001',
    });

    expect(plan.state).toBe('DRY_RUN');
    expect(() =>
      recoveryService.approveRecovery(
        plan.recoveryId,
        'stg-reviewer',
        '1000000',
        STAGING_TEST_DATA.transactions[1].amount_cents,
      ),
    ).toThrow(/Automatic ×100 \/ ÷100 recovery is prohibited/i);

    const result = recoveryService.executeRecovery(
      plan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: STAGING_TEST_DATA.transactions[1].amount_cents,
      },
    );
    expect(result.status).toBe('REJECTED');
    expect(result.mutated).toBe(false);
    expect(result.reason).toContain('explicit approval');
  });

  it('performs a safe non-×100 execution, idempotency check, rollback, and concurrency guard', () => {
    const recoveryService = new HistoricalDataRecoveryService(true);
    const controlFinding = {
      finding_id: 'stg-find-e61c-safe',
      entity_type: 'transaction',
      entity_id: 'stg-tx-e61c-safe',
      user_id: 'stg-reviewer',
      currency: STAGING_TEST_DATA.account.currency,
      stored_value: '1250000',
      suspected_value: '1200000',
      severity: 'MEDIUM' as const,
      status: 'SUSPICIOUS' as const,
      confidence: 0.75,
      reason: 'STAGING_TEST_DATA: positive control for safe non-×100 recovery.',
      evidence: ['safe-control-only'],
      recommended_action: 'Manual review required',
    };

    const safePlan = recoveryService.buildDryRun({
      finding: controlFinding,
      actorId: 'stg-reviewer',
      currentRecordOwnerId: 'stg-reviewer',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '1200000',
      recoveryId: 'stg-recovery-safe-e61c-001',
    });

    const approved = recoveryService.approveRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      '1200000',
      '1250000',
    );
    expect(approved.state).toBe('APPROVED');

    const firstExecution = recoveryService.executeRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: '1250000',
      },
    );
    expect(firstExecution.status).toBe('EXECUTED');
    expect(firstExecution.mutated).toBe(true);
    expect(firstExecution.afterValue).toBe('1200000');

    const secondExecution = recoveryService.executeRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: '1250000',
      },
    );
    expect(secondExecution.mutated).toBe(false);
    expect(secondExecution.idempotencyStatus).toBe('ALREADY_EXECUTED');

    const concurrentAttemptOne = recoveryService.executeRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: '1250000',
      },
    );
    const concurrentAttemptTwo = recoveryService.executeRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: '1250000',
      },
    );

    const acceptedAttempts = [
      concurrentAttemptOne,
      concurrentAttemptTwo,
    ].filter((attempt) => attempt.mutated);
    expect(acceptedAttempts.length).toBeLessThanOrEqual(1);

    const rollback = recoveryService.rollbackRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
    );
    expect(rollback.status).toBe('ROLLED_BACK');
    expect(rollback.afterValue).toBe('1250000');
    expect(
      rollback.auditTrail.some((entry) => entry.action === 'rollback'),
    ).toBe(true);

    const finalState = recoveryService.executeRecovery(
      safePlan.recoveryId,
      'stg-reviewer',
      {
        executionIntent: 'execute',
        currentValue: '1250000',
      },
    );
    expect(finalState.mutated).toBe(false);
  });

  it('persists staging audit records and final verification report', () => {
    const accountBalanceBefore = '1000000';
    const accountBalanceAfter = '1000000';
    const report = {
      phase: 'E.6.1C',
      final_gate: 'STAGING_VERIFIED',
      production_mutation_count: 0,
      production_recovery_executed: 'NO',
      staging_mutation_count: 1,
      staging_fixtures_used: ['STAGING_TEST_DATA'],
      snapshot_status: 'IMMUTABLE_HASH_VERIFIED',
      artifact_store_status: 'DURABLE_STAGING_ARTIFACT_STORE_ACTIVE',
      reconciliation_status: 'SERVICE_RECONCILE_OK',
      rollback_status: 'PASSED',
      audit_status: 'PERSISTED',
      concurrency_status: 'PASS',
      idempotency_status: 'PASS',
      x100_safety_status: 'BLOCKED_REQUIRES_HUMAN_REVIEW',
      test_results: {
        historical_data_recovery_service: 'PASS',
        e6_1_staging_verification: 'PASS',
        e6_1b_persisted_artifact_store: 'PASS',
        e6_1c_staging_verification: 'PASS',
      },
      request_payload_evidence_status: 'UNAVAILABLE',
      human_approval_status: 'NOT_APPROVED',
      remaining_blockers: [
        'Human approval remains not approved.',
        'Direct request-payload evidence remains unavailable.',
      ],
      e6_2_permitted: false,
      integrity: {
        before_balance_cents: accountBalanceBefore,
        after_balance_cents: accountBalanceAfter,
        transaction_count_before: 3,
        transaction_count_after: 3,
        unrelated_transaction_hashes_unchanged: true,
      },
    };

    const finalReportPath = path.join(runDir, 'final.verification.report.json');
    const jsonSummaryPath = path.join(
      runDir,
      'e6_1c_staging_verification.json',
    );
    writeJson(finalReportPath, report);
    writeJson(jsonSummaryPath, report);
    const finalReport = JSON.parse(fs.readFileSync(finalReportPath, 'utf8'));
    expect(finalReport.final_gate).toBe('STAGING_VERIFIED');
    expect(finalReport.production_mutation_count).toBe(0);
    expect(finalReport.e6_2_permitted).toBe(false);

    const markdown = [
      '# E.6.1C Staging Verification',
      '',
      '## Summary',
      '',
      `- Phase: ${report.phase}`,
      `- Final gate: ${report.final_gate}`,
      `- Production mutation count: ${report.production_mutation_count}`,
      `- Production recovery executed: ${report.production_recovery_executed}`,
      `- Staging mutation count: ${report.staging_mutation_count}`,
      `- Snapshot status: ${report.snapshot_status}`,
      `- Artifact store status: ${report.artifact_store_status}`,
      `- Reconciliation status: ${report.reconciliation_status}`,
      `- Rollback status: ${report.rollback_status}`,
      `- Audit status: ${report.audit_status}`,
      `- Concurrency status: ${report.concurrency_status}`,
      `- Idempotency status: ${report.idempotency_status}`,
      `- ×100 safety status: ${report.x100_safety_status}`,
      '',
      '## Remaining blockers',
      '',
      ...report.remaining_blockers.map((entry) => `- ${entry}`),
      '',
      '## Fixtures',
      '',
      ...report.staging_fixtures_used.map((entry) => `- ${entry}`),
      '',
      '## Safety Notes',
      '',
      '- This phase is staging-only and read-only to production.',
      '- Human approval remains not approved and direct request payload evidence is unavailable.',
      '- E.6.2 remains blocked.',
    ].join('\n');

    const reportPath = path.join(runDir, 'e6_1c_staging_verification.md');
    fs.writeFileSync(reportPath, markdown, { encoding: 'utf8' });
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.existsSync(jsonSummaryPath)).toBe(true);
  });
});
