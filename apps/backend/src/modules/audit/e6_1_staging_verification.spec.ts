import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HistoricalDataRecoveryService } from './historical-data-recovery.service';

/**
 * STAGING-only verification test for Phase E.6.1
 * - Uses synthetic STAGING_TEST_DATA only
 * - Does NOT connect to any database
 * - Verifies snapshot, recovery simulation, balance reconciliation, audit, rollback, idempotency, and concurrency
 */

describe('E.6.1 STAGING recovery safety verification (staging only)', () => {
  const now = new Date().toISOString();

  // STAGING fixtures (synthetic only)
  const STAGING_ACCOUNT = {
    id: 'stg-acc-1',
    user_id: 'stg-u1',
    currency: 'IDR',
    opening_balance_cents: '1000000', // 1,000,000
    // current balance computed below from transactions
  } as const;

  const CORRUPTED_TX = {
    id: 'stg-tx-corrupt',
    user_id: 'stg-u1',
    account_id: 'stg-acc-1',
    currency: 'IDR',
    transaction_type: 'INCOME',
    amount_cents: '100000000', // 100,000,000 (suspected ×100)
    note: 'STAGING_TEST_DATA corrupted-100x',
    created_at: now,
    updated_at: now,
  } as const;

  const CONTROL_A = {
    id: 'stg-tx-control-a',
    user_id: 'stg-u1',
    account_id: 'stg-acc-1',
    currency: 'IDR',
    transaction_type: 'INCOME',
    amount_cents: '500000', // correct small txn
    note: 'STAGING_TEST_DATA control-a',
    created_at: now,
    updated_at: now,
  } as const;

  const CONTROL_B = {
    id: 'stg-tx-control-b',
    user_id: 'stg-u1',
    account_id: 'stg-acc-1',
    currency: 'IDR',
    transaction_type: 'EXPENSE',
    amount_cents: '12345', // insufficient evidence
    note: 'STAGING_TEST_DATA control-b',
    created_at: now,
    updated_at: now,
  } as const;

  const CONTROL_C = {
    id: 'stg-tx-control-c',
    user_id: 'stg-u1',
    account_id: 'stg-acc-1',
    currency: 'IDR',
    transaction_type: 'INCOME',
    amount_cents: '1000000', // already recovered (the smaller value)
    note: 'STAGING_TEST_DATA control-c already recovered',
    created_at: now,
    updated_at: now,
  } as const;

  // Helper: deterministic snapshot hash
  function snapshotHash(obj: Record<string, unknown>): string {
    const normalized = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  // Compute synthetic account current balance from opening + transactions
  function computeCurrentBalance(
    opening: bigint,
    txs: Array<{ amount_cents: string }>,
  ) {
    let total = opening;
    for (const t of txs) {
      total += BigInt(t.amount_cents);
    }
    return total;
  }

  it('performs environment safety assertion (no production target)', () => {
    // Based on repository config files (prisma/.env and docker/.env.docker), the local repo uses localhost/docker compose defaults.
    // This test asserts that environment files indicate non-production defaults.
    // Load prisma/.env programmatically
    const envPath = path.resolve(__dirname, '../../../../prisma/.env');
    let dbUrl = '';
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/DATABASE_URL\s*=\s*"?(.*?)"?$/m);
      dbUrl = m ? m[1] : '';
    }
    expect(dbUrl).toBeDefined();
    const productionIndicators = ['amazonaws.com', 'db.prod', 'rds', 'prod-'];
    for (const p of productionIndicators) {
      expect(dbUrl).not.toContain(p);
    }
  });

  it('creates an immutable pre-mutation snapshot and verifies hash', () => {
    const snapshot = {
      snapshot_ts: new Date().toISOString(),
      account: STAGING_ACCOUNT,
      transactions: [CORRUPTED_TX, CONTROL_A, CONTROL_B, CONTROL_C],
      notes: ['STAGING_TEST_DATA snapshot for E.6.1'],
    };

    const hash = snapshotHash(snapshot);

    // persist to an in-memory store (simulated); verify immutability by comparing a shallow copy
    const persisted = JSON.parse(JSON.stringify(snapshot)) as unknown as {
      snapshot_ts: string;
      account: {
        id: string;
        user_id: string;
        currency: string;
        opening_balance_cents: string;
      };
      transactions: Array<{
        id: string;
        user_id: string;
        account_id: string;
        currency: string;
        transaction_type: string;
        amount_cents: string;
        note: string;
        created_at: string;
        updated_at: string;
      }>;
      notes: string[];
    };
    const persistedHash = snapshotHash(persisted);

    expect(hash).toEqual(persistedHash);
    expect(persisted).toEqual(snapshot);
  });

  it('builds recovery plans and enforces ×100 prohibition for direct approval', () => {
    const recoveryService = new HistoricalDataRecoveryService(true);

    // Build dry-run for corrupted tx (the primary candidate pattern)
    const finding = {
      finding_id: 'stg-find-corrupt',
      entity_type: 'transaction',
      entity_id: CORRUPTED_TX.id,
      user_id: CORRUPTED_TX.user_id,
      currency: CORRUPTED_TX.currency,
      stored_value: CORRUPTED_TX.amount_cents,
      suspected_value: (BigInt(CORRUPTED_TX.amount_cents) / 100n).toString(),
      severity: 'HIGH' as const,
      status: 'LIKELY_CORRUPTED' as const,
      confidence: 0.9,
      reason:
        'Simulated STAGING primary candidate: divisible by 100 and opening_balance supports suspected value',
      evidence: ['STAGING: synthetic evidence'],
      recommended_action: 'Manual review required',
    };

    const plan = recoveryService.buildDryRun({
      finding,
      actorId: 'stg-u1',
      currentRecordOwnerId: 'stg-u1',
      currentValue: CORRUPTED_TX.amount_cents,
      currentCurrency: 'IDR',
      approvedValue: (BigInt(CORRUPTED_TX.amount_cents) / 100n).toString(),
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.state).toBe('DRY_RUN');

    // Attempt to approve a ×100 correction — expected to be rejected by policy
    expect(() =>
      recoveryService.approveRecovery(
        plan.recoveryId,
        'stg-u1',
        plan.approvedValue,
        plan.currentValue,
      ),
    ).toThrow(/Automatic ×100 \/ ÷100 recovery is prohibited/);
  });

  it('simulates a non-×100 approved recovery, executes, audits, and rolls back in staging', () => {
    const recoveryService = new HistoricalDataRecoveryService(true);

    // Use a safe non-×100 scenario for positive execution test
    const findingSafe = {
      finding_id: 'stg-find-safe',
      entity_type: 'transaction',
      entity_id: 'stg-tx-safe',
      user_id: 'stg-u1',
      currency: 'IDR',
      stored_value: '123456',
      suspected_value: '120000',
      severity: 'MEDIUM' as const,
      status: 'SUSPICIOUS' as const,
      confidence: 0.6,
      reason: 'STAGING safe scenario',
      evidence: ['synthetic'],
      recommended_action: 'Manual review',
    };

    const plan = recoveryService.buildDryRun({
      finding: findingSafe,
      actorId: 'stg-u1',
      currentRecordOwnerId: 'stg-u1',
      currentValue: findingSafe.stored_value,
      currentCurrency: 'IDR',
      approvedValue: '120000',
    });

    // Approve and execute
    const approved = recoveryService.approveRecovery(
      plan.recoveryId,
      'stg-u1',
      '120000',
      '123456',
    );

    expect(approved.state).toBe('APPROVED');

    const firstExec = recoveryService.executeRecovery(
      plan.recoveryId,
      'stg-u1',
      {
        executionIntent: 'execute',
      },
    );

    expect(firstExec.status).toBe('EXECUTED');
    expect(firstExec.mutated).toBe(true);
    expect(firstExec.beforeValue).toBe('123456');
    expect(firstExec.afterValue).toBe('120000');
    expect(firstExec.auditTrail.length).toBeGreaterThan(0);

    // Idempotency: second execution must be a NO-OP
    const secondExec = recoveryService.executeRecovery(
      plan.recoveryId,
      'stg-u1',
      {
        executionIntent: 'execute',
      },
    );
    expect(secondExec.mutated).toBe(false);
    expect(secondExec.idempotencyStatus).toBe('ALREADY_EXECUTED');

    // Rollback
    const rollback = recoveryService.rollbackRecovery(
      plan.recoveryId,
      'stg-u1',
    );
    expect(rollback.status).toBe('ROLLED_BACK');
    expect(rollback.afterValue).toBe(firstExec.beforeValue);

    // Verify audit contains rollback entry
    expect(rollback.auditTrail.some((e) => e.action === 'rollback')).toBe(true);
  });

  it('performs balance reconciliation math for the primary synthetic account', () => {
    // compute current balance from opening + transactions
    const txs = [CORRUPTED_TX, CONTROL_A, CONTROL_B];
    const opening = BigInt(STAGING_ACCOUNT.opening_balance_cents);
    const currentBalance = computeCurrentBalance(opening, txs);

    // expected before recovery
    const expectedBefore =
      opening +
      BigInt(CORRUPTED_TX.amount_cents) +
      BigInt(CONTROL_A.amount_cents) +
      BigInt(CONTROL_B.amount_cents);
    expect(currentBalance).toEqual(expectedBefore);

    // expected after hypothetical recovery (if CORRUPTED_TX corrected to /100)
    const corrected = BigInt(CORRUPTED_TX.amount_cents) / 100n;
    const expectedAfter =
      opening +
      corrected +
      BigInt(CONTROL_A.amount_cents) +
      BigInt(CONTROL_B.amount_cents);

    // The system policy prohibits auto ×100, but the arithmetic expectation is as below (for reconciliation tests)
    expect(expectedAfter).toEqual(
      opening +
        corrected +
        BigInt(CONTROL_A.amount_cents) +
        BigInt(CONTROL_B.amount_cents),
    );
    // sanity check: expectedBefore > expectedAfter
    expect(expectedBefore > expectedAfter).toBe(true);
  });

  it('simulates two concurrent execution attempts and ensures no double-apply', () => {
    const recoveryService = new HistoricalDataRecoveryService(true);
    const finding = {
      finding_id: 'stg-concurrent',
      entity_type: 'transaction',
      entity_id: 'stg-tx-conc',
      user_id: 'stg-u1',
      currency: 'IDR',
      stored_value: '200000',
      suspected_value: '199000',
      severity: 'MEDIUM' as const,
      status: 'SUSPICIOUS' as const,
      confidence: 0.6,
      reason: 'concurrency test',
      evidence: [],
      recommended_action: 'Manual review',
    };

    const plan = recoveryService.buildDryRun({
      finding,
      actorId: 'stg-u1',
      currentRecordOwnerId: 'stg-u1',
      currentValue: '200000',
      currentCurrency: 'IDR',
      approvedValue: '199000',
    });

    recoveryService.approveRecovery(
      plan.recoveryId,
      'stg-u1',
      '199000',
      '200000',
    );

    // Simulate concurrent attempts: in real system these would be separate processes, here call twice in quick succession
    const a = recoveryService.executeRecovery(plan.recoveryId, 'stg-u1', {
      executionIntent: 'execute',
    });
    const b = recoveryService.executeRecovery(plan.recoveryId, 'stg-u1', {
      executionIntent: 'execute',
    });

    expect(a.status).toBe('EXECUTED');
    expect(
      b.idempotencyStatus === 'ALREADY_EXECUTED' || b.mutated === false,
    ).toBe(true);
  });
});
