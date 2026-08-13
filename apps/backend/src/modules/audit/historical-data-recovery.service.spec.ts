import { HistoricalDataRecoveryService } from './historical-data-recovery.service';

describe('HistoricalDataRecoveryService', () => {
  const findingBase = {
    finding_id: 'find-1',
    entity_type: 'account',
    entity_id: 'acc-1',
    user_id: 'u1',
    currency: 'IDR',
    stored_value: '1000000',
    suspected_value: '950000',
    severity: 'MEDIUM' as const,
    status: 'INCONSISTENT' as const,
    confidence: 0.9,
    reason: 'Stored balance differs from reconstructed balance.',
    evidence: ['stored_balance=1000000', 'reconstructed_balance=950000'],
    recommended_action: 'Manual review required.',
  };

  it('dry-run performs zero mutation by default', () => {
    const service = new HistoricalDataRecoveryService(false);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.state).toBe('DRY_RUN');
    expect(service.executeRecovery(plan.recoveryId, 'u1').mutated).toBe(false);
  });

  it('requires manual approval before a recovery can execute', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    expect(() =>
      service.approveRecovery(plan.recoveryId, 'u1', undefined, '1000000'),
    ).toThrow('Manual approval is required before execution');
  });

  it('rejects unauthorized user recovery attempts', () => {
    const service = new HistoricalDataRecoveryService(true);

    expect(() =>
      service.buildDryRun({
        finding: findingBase,
        actorId: 'u2',
        currentRecordOwnerId: 'u1',
        currentValue: '1000000',
        currentCurrency: 'IDR',
        approvedValue: '950000',
      }),
    ).toThrow('Unauthorized');
  });

  it('rejects unsupported currency and currency mismatch', () => {
    const service = new HistoricalDataRecoveryService(true);

    expect(() =>
      service.buildDryRun({
        finding: { ...findingBase, currency: 'XXX' },
        actorId: 'u1',
        currentRecordOwnerId: 'u1',
        currentValue: '1000000',
        currentCurrency: 'XXX',
        approvedValue: '950000',
      }),
    ).toThrow();

    expect(() =>
      service.buildDryRun({
        finding: { ...findingBase, currency: 'USD' },
        actorId: 'u1',
        currentRecordOwnerId: 'u1',
        currentValue: '1000000',
        currentCurrency: 'IDR',
        approvedValue: '950000',
      }),
    ).toThrow('Currency mismatch');
  });

  it('marks stale findings before execution', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    const approved = service.approveRecovery(
      plan.recoveryId,
      'u1',
      '950000',
      '1100000',
    );
    expect(approved.state).toBe('STALE');
    expect(service.executeRecovery(plan.recoveryId, 'u1').status).toBe('STALE');
  });

  it('prevents automatic ×100 and ÷100 corrections', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: {
        ...findingBase,
        stored_value: '1000000',
        suspected_value: '10000',
      },
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '10000',
    });

    expect(() =>
      service.approveRecovery(plan.recoveryId, 'u1', '10000', '1000000'),
    ).toThrow('Automatic ×100 / ÷100 recovery is prohibited');
  });

  it('idempotently handles repeated execution and records an audit trail', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    service.approveRecovery(plan.recoveryId, 'u1', '950000', '1000000');
    const first = service.executeRecovery(plan.recoveryId, 'u1');
    const second = service.executeRecovery(plan.recoveryId, 'u1');

    expect(first.status).toBe('EXECUTED');
    expect(second.status).toBe('EXECUTED');
    expect(first.auditTrail.length).toBeGreaterThan(0);
  });

  it('rolls back to the exact original value and preserves audit history', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    service.approveRecovery(plan.recoveryId, 'u1', '950000', '1000000');
    service.executeRecovery(plan.recoveryId, 'u1');
    const rollback = service.rollbackRecovery(plan.recoveryId, 'u1');

    expect(rollback.status).toBe('ROLLED_BACK');
    expect(rollback.afterValue).toBe('1000000');
    expect(
      rollback.auditTrail.some((entry) => entry.action === 'rollback'),
    ).toBe(true);
  });

  it('preserves exact BigInt values and MAX_SAFE_INTEGER boundaries', () => {
    const service = new HistoricalDataRecoveryService(true);
    const serviceWithBigInt = service as unknown as {
      normalizeBigInt: (value: string) => bigint;
    };
    const values = [
      '9007199254740991',
      '9007199254740992',
      '9007199254740993',
      '900719925474099200',
      '0',
      '-123',
    ];

    for (const value of values) {
      const parsed = serviceWithBigInt.normalizeBigInt(value);
      expect(parsed.toString()).toBe(value);
    }

    expect(serviceWithBigInt.normalizeBigInt('9007199254740993')).not.toBe(
      serviceWithBigInt.normalizeBigInt('9007199254740992'),
    );
  });

  it('requires an explicit execution intent for controlled execution', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    service.approveRecovery(plan.recoveryId, 'u1', '950000', '1000000');
    const result = service.executeRecovery(plan.recoveryId, 'u1', {
      executionIntent: 'dry-run',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.mutated).toBe(false);
    expect(result.reason).toContain('Dry-run mode cannot execute');
  });

  it('supports idempotent re-execution without duplicating mutation', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    service.approveRecovery(plan.recoveryId, 'u1', '950000', '1000000');
    const first = service.executeRecovery(plan.recoveryId, 'u1', {
      executionIntent: 'execute',
    });
    const second = service.executeRecovery(plan.recoveryId, 'u1', {
      executionIntent: 'execute',
    });

    expect(first.status).toBe('EXECUTED');
    expect(first.idempotencyStatus).toBe('FIRST_EXECUTION');
    expect(second.idempotencyStatus).toBe('ALREADY_EXECUTED');
    expect(second.mutated).toBe(false);
  });

  it('rejects simulated transaction failure without mutating state', () => {
    const service = new HistoricalDataRecoveryService(true);
    const plan = service.buildDryRun({
      finding: findingBase,
      actorId: 'u1',
      currentRecordOwnerId: 'u1',
      currentValue: '1000000',
      currentCurrency: 'IDR',
      approvedValue: '950000',
    });

    service.approveRecovery(plan.recoveryId, 'u1', '950000', '1000000');
    const result = service.executeRecovery(plan.recoveryId, 'u1', {
      executionIntent: 'execute',
      simulateFailure: true,
    });

    expect(result.status).toBe('FAILED');
    expect(result.mutated).toBe(false);
    expect(plan.currentValue).toBe('1000000');
  });

  it('requires explicit transfer side selection for transfer mismatch findings', () => {
    const service = new HistoricalDataRecoveryService(true);
    const finding = {
      ...findingBase,
      entity_type: 'transfer',
      entity_id: 'group-1',
      currency: 'USD',
      stored_value: '123',
      suspected_value: '124',
      reason: 'Transfer legs within the same group carry different amounts.',
      evidence: ['source and destination currency differ'],
    };

    expect(() =>
      service.buildDryRun({
        finding,
        actorId: 'u1',
        currentRecordOwnerId: 'u1',
        currentValue: '123',
        currentCurrency: 'USD',
        approvedValue: '124',
      }),
    ).toThrow('Transfer mismatch requires explicit side selection');
  });

  it('never auto-fixes cross-currency transfer or single-leg transfer findings', () => {
    const service = new HistoricalDataRecoveryService(true);

    expect(() =>
      service.buildDryRun({
        finding: {
          ...findingBase,
          entity_type: 'transfer',
          entity_id: 'group-cross',
          currency: 'USD/IDR',
          stored_value: '100',
          suspected_value: '100',
          reason:
            'Cross-currency historical transfer exists and must not be silently treated as a same-currency transfer.',
          evidence: ['source and destination currency differ'],
        },
        actorId: 'u1',
        currentRecordOwnerId: 'u1',
        currentValue: '100',
        currentCurrency: 'USD/IDR',
        approvedValue: '100',
        selectedTransferSide: 'source',
      }),
    ).toThrow();
  });
});
