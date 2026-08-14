import { HistoricalDataRecoveryService } from './historical-data-recovery.service';
import {
  computeSourceFingerprint,
  RecoveryApplyOutcome,
  RecoveryApplyRequest,
  RecoveryCandidate,
  RecoveryRollbackOutcome,
  RecoveryRollbackRequest,
  RecoveryWriteGateway,
} from './historical-recovery-writeback.contracts';

class FakeGateway implements RecoveryWriteGateway {
  applyCalls: RecoveryApplyRequest[] = [];

  rollbackCalls: RecoveryRollbackRequest[] = [];

  applyOutcome: RecoveryApplyOutcome;

  rollbackOutcome: RecoveryRollbackOutcome;

  constructor(
    applyOutcome: Partial<RecoveryApplyOutcome>,
    rollbackOutcome: Partial<RecoveryRollbackOutcome> = {},
  ) {
    this.applyOutcome = {
      status: 'APPLIED',
      mutated: true,
      recoveryId: 'recovery-1',
      beforeValueCents: 1250000n,
      afterValueCents: 1200000n,
      currency: 'IDR',
      reason: 'approved recovery applied',
      sourceFingerprint: computeSourceFingerprint(CANDIDATE),
      ledgerStatus: 'APPLIED',
      newBalanceCents: 2100000n,
      ...applyOutcome,
    };
    this.rollbackOutcome = {
      status: 'ROLLED_BACK',
      mutated: true,
      recoveryId: 'recovery-1',
      beforeValueCents: 1200000n,
      afterValueCents: 1250000n,
      currency: 'IDR',
      reason: 'recovery rolled back',
      sourceFingerprint: 'fingerprint',
      ledgerStatus: 'ROLLED_BACK',
      ...rollbackOutcome,
    };
  }

  applyRecovery(request: RecoveryApplyRequest): Promise<RecoveryApplyOutcome> {
    this.applyCalls.push(request);
    return Promise.resolve({ ...this.applyOutcome });
  }

  rollbackRecovery(
    request: RecoveryRollbackRequest,
  ): Promise<RecoveryRollbackOutcome> {
    this.rollbackCalls.push(request);
    return Promise.resolve({ ...this.rollbackOutcome });
  }
}

const CANDIDATE: RecoveryCandidate = {
  entityType: 'transaction',
  entityId: 'tx-candidate',
  userId: 'u1',
  accountId: 'acc-a',
  currency: 'IDR',
  transactionType: 'INCOME',
  transactionDate: new Date('2026-08-11T14:08:31.606Z'),
  amountCents: 1250000n,
};

function buildFinding(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    finding_id: 'finding-1',
    entity_type: 'transaction',
    entity_id: 'tx-candidate',
    user_id: 'u1',
    currency: 'IDR',
    severity: 'HIGH',
    status: 'SUSPICIOUS',
    confidence: 0.95,
    reason:
      'Reviewed amount differs from the corrected figure for transaction tx-candidate.',
    evidence: ['synthetic-evidence', 'unit-fixture'],
    recommended_action: 'Apply corrected value.',
    current_value: '1250000',
    proposed_value: '1200000',
    requires_manual_approval: true,
    ...overrides,
  };
}

interface PlanContext {
  service: HistoricalDataRecoveryService;
  gateway: FakeGateway;
  recoveryId: string;
}

function buildPlan(
  overrides: {
    finding?: Record<string, unknown>;
    actorId?: string;
    approvedValue?: string;
    service?: HistoricalDataRecoveryService;
  } = {},
): PlanContext {
  const gateway = overrides.service ? new FakeGateway({}) : new FakeGateway({});
  const service =
    overrides.service ?? new HistoricalDataRecoveryService(true, gateway);
  const finding = buildFinding(overrides.finding ?? {});
  const actorId = overrides.actorId ?? 'u1';
  const plan = service.buildDryRun({
    finding: finding as never,
    actorId,
    currentValue: '1250000',
    currentCurrency: 'IDR',
    approvedValue: overrides.approvedValue ?? '1200000',
    currentRecordOwnerId: 'u1',
  });
  service.approveRecovery(
    plan.recoveryId,
    actorId,
    overrides.approvedValue ?? '1200000',
    '1250000',
  );
  return { service, gateway, recoveryId: plan.recoveryId };
}

describe('HistoricalDataRecoveryService persistent write-back (unit)', () => {
  const fingerprint = computeSourceFingerprint(CANDIDATE);

  it('executes a persisted recovery through the gateway with exact approved values and evidence', async () => {
    const { service, gateway, recoveryId } = buildPlan();

    const result = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('EXECUTED');
    expect(result.mutated).toBe(true);
    expect(result.idempotencyStatus).toBe('FIRST_EXECUTION');
    expect(result.beforeValue).toBe('1250000');
    expect(result.afterValue).toBe('1200000');
    expect(gateway.applyCalls.length).toBe(1);
    expect(gateway.applyCalls[0].recoveryId).toBe(recoveryId);
    expect(gateway.applyCalls[0].findingId).toBe('finding-1');
    expect(gateway.applyCalls[0].approvedBy).toBe('u1');
    expect(gateway.applyCalls[0].actorId).toBe('u1');
    expect(gateway.applyCalls[0].beforeValueCents).toBe(1250000n);
    expect(gateway.applyCalls[0].afterValueCents).toBe(1200000n);
    expect(gateway.applyCalls[0].currency).toBe('IDR');
    expect(gateway.applyCalls[0].candidate).toEqual(CANDIDATE);
    expect(gateway.applyCalls[0].evidence).toEqual([
      'synthetic-evidence',
      'unit-fixture',
    ]);

    const executionAudit = result.auditTrail.find(
      (entry) => entry.action === 'execute',
    );
    expect(executionAudit?.evidence).toContain(
      'durable-ledger-entry-committed',
    );
    expect(executionAudit?.evidence).toContain(
      `persisted-ledger-status=APPLIED`,
    );
    expect(executionAudit?.evidence).toContain(
      `source-fingerprint=${fingerprint}`,
    );
  });

  it('rejects execution when no write gateway is configured', async () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: buildFinding() as never,
      actorId: 'u1',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '1200000',
    });
    service.approveRecovery(plan.recoveryId, 'u1', '1200000', '1250000');

    const result = await service.executeRecoveryPersistent(
      plan.recoveryId,
      'u1',
      { candidate: CANDIDATE },
    );

    expect(result.status).toBe('REJECTED');
    expect(result.mutated).toBe(false);
    expect(result.reason).toContain('no gateway is configured');
  });

  it('rejects execution when recovery is disabled by configuration', async () => {
    const gateway = new FakeGateway({});
    const service = new HistoricalDataRecoveryService(false, gateway);
    const plan = service.buildDryRun({
      finding: buildFinding() as never,
      actorId: 'u1',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '1200000',
    });
    service.approveRecovery(plan.recoveryId, 'u1', '1200000', '1250000');

    const result = await service.executeRecoveryPersistent(
      plan.recoveryId,
      'u1',
      { candidate: CANDIDATE },
    );

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('disabled by configuration');
    expect(gateway.applyCalls.length).toBe(0);
  });

  it('rejects execution when the approved candidate snapshot is missing', async () => {
    const { service, gateway, recoveryId } = buildPlan();

    const result = await service.executeRecoveryPersistent(
      recoveryId,
      'u1',
      {},
    );

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('candidate snapshot');
    expect(gateway.applyCalls.length).toBe(0);
  });

  it('rejects execution for non-transaction findings', async () => {
    const { service, gateway, recoveryId } = buildPlan({
      finding: { entity_type: 'account', entity_id: 'acc-a' },
    });

    const result = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('transaction recoveries only');
    expect(gateway.applyCalls.length).toBe(0);
  });

  it('rejects execution when the finding carries no preserved evidence', async () => {
    const { service, gateway, recoveryId } = buildPlan({
      finding: { evidence: [] },
    });

    const result = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('preserved evidence');
    expect(gateway.applyCalls.length).toBe(0);
  });

  it('rejects execution before explicit approval', async () => {
    const service = new HistoricalDataRecoveryService(
      true,
      new FakeGateway({}),
    );
    const plan = service.buildDryRun({
      finding: buildFinding() as never,
      actorId: 'u1',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '1200000',
    });

    const result = await service.executeRecoveryPersistent(
      plan.recoveryId,
      'u1',
      { candidate: CANDIDATE },
    );

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('explicit approval');
  });

  it('rejects execution by a different actor', async () => {
    const { service, gateway, recoveryId } = buildPlan();

    const result = await service.executeRecoveryPersistent(recoveryId, 'u2', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('Unauthorized');
    expect(gateway.applyCalls.length).toBe(0);
  });

  it('preserves the automatic ×100 / ÷100 prohibition during approval', () => {
    const service = new HistoricalDataRecoveryService(
      true,
      new FakeGateway({}),
    );
    const plan = service.buildDryRun({
      finding: buildFinding() as never,
      actorId: 'u1',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '125000000',
    });

    expect(() =>
      service.approveRecovery(plan.recoveryId, 'u1', '125000000', '1250000'),
    ).toThrow(/×100/);
  });

  it('maps an idempotent gateway outcome without a second mutation', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    gateway.applyOutcome = {
      ...gateway.applyOutcome,
      status: 'ALREADY_EXECUTED',
      mutated: false,
      beforeValueCents: 1250000n,
      afterValueCents: 1200000n,
      ledgerStatus: 'APPLIED',
    };

    const result = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('EXECUTED');
    expect(result.mutated).toBe(false);
    expect(result.idempotencyStatus).toBe('ALREADY_EXECUTED');
  });

  it('returns idempotency from the in-memory ledger without calling the gateway again', async () => {
    const { service, gateway, recoveryId } = buildPlan();

    const first = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });
    const second = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(first.mutated).toBe(true);
    expect(second.status).toBe('EXECUTED');
    expect(second.mutated).toBe(false);
    expect(second.idempotencyStatus).toBe('ALREADY_EXECUTED');
    expect(gateway.applyCalls.length).toBe(1);
  });

  it('maps a stale gateway outcome without mutation', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    gateway.applyOutcome = {
      ...gateway.applyOutcome,
      status: 'STALE',
      mutated: false,
      reason: 'Stale recovery candidate: the stored amount no longer matches.',
    };

    const result = await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(result.status).toBe('STALE');
    expect(result.mutated).toBe(false);
    expect(result.reason).toContain('Stale recovery candidate');
  });

  it('rolls back a persisted recovery to the exact original value', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    const result = await service.rollbackRecoveryPersistent(recoveryId, 'u1');

    expect(result.status).toBe('ROLLED_BACK');
    expect(result.mutated).toBe(true);
    expect(result.beforeValue).toBe('1200000');
    expect(result.afterValue).toBe('1250000');
    expect(gateway.rollbackCalls.length).toBe(1);
    expect(gateway.rollbackCalls[0]).toEqual({ recoveryId, actorId: 'u1' });
    const rollbackAudit = result.auditTrail.find(
      (entry) => entry.action === 'rollback',
    );
    expect(rollbackAudit?.evidence).toContain('durable-ledger-entry-updated');
  });

  it('maps an idempotent rollback outcome without mutation', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });
    gateway.rollbackOutcome = {
      ...gateway.rollbackOutcome,
      status: 'ALREADY_ROLLED_BACK',
      mutated: false,
      afterValueCents: 1250000n,
    };

    const result = await service.rollbackRecoveryPersistent(recoveryId, 'u1');

    expect(result.status).toBe('ROLLED_BACK');
    expect(result.mutated).toBe(false);
    expect(result.afterValue).toBe('1250000');
  });

  it('refuses a second persistent rollback once rolled back', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });
    await service.rollbackRecoveryPersistent(recoveryId, 'u1');

    await expect(
      service.rollbackRecoveryPersistent(recoveryId, 'u1'),
    ).rejects.toThrow(/already been rolled back/);
    expect(gateway.rollbackCalls.length).toBe(1);
  });

  it('rejects rollback by a different actor', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    await expect(
      service.rollbackRecoveryPersistent(recoveryId, 'u2'),
    ).rejects.toThrow(/Unauthorized/);
    expect(gateway.rollbackCalls.length).toBe(0);
  });

  it('maps a stale rollback outcome without mutation', async () => {
    const { service, gateway, recoveryId } = buildPlan();
    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });
    gateway.rollbackOutcome = {
      ...gateway.rollbackOutcome,
      status: 'STALE',
      mutated: false,
      reason:
        'Rollback is stale: the recovery target amount no longer matches.',
    };

    const result = await service.rollbackRecoveryPersistent(recoveryId, 'u1');

    expect(result.status).toBe('STALE');
    expect(result.mutated).toBe(false);
    expect(result.reason).toContain('Rollback is stale');
  });

  it('rejects rollback when no write gateway is configured', async () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: buildFinding() as never,
      actorId: 'u1',
      currentValue: '1250000',
      currentCurrency: 'IDR',
      approvedValue: '1200000',
    });
    service.approveRecovery(plan.recoveryId, 'u1', '1200000', '1250000');
    await service.executeRecoveryPersistent(plan.recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    const result = await service.rollbackRecoveryPersistent(
      plan.recoveryId,
      'u1',
    );

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('no gateway is configured');
  });

  it('passes the reviewed candidate fingerprint to the gateway outcome', async () => {
    const { service, gateway, recoveryId } = buildPlan();

    await service.executeRecoveryPersistent(recoveryId, 'u1', {
      candidate: CANDIDATE,
    });

    expect(gateway.applyCalls[0].candidate).toEqual(CANDIDATE);
    const applied = gateway.applyCalls[0];
    expect(computeSourceFingerprint(applied.candidate)).toBe(fingerprint);
  });
});
