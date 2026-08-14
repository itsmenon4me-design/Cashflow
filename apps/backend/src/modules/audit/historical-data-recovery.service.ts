import { CURRENCY_SPECS } from '../../common/types/money';
import {
  AuditFinding,
  ProposedRecoveryAction,
} from './historical-data-audit.service';
import {
  RecoveryApplyOutcome,
  RecoveryCandidate,
  RecoveryRollbackOutcome,
  RecoveryWriteGateway,
} from './historical-recovery-writeback.contracts';

export type RecoveryState =
  | 'DETECTED'
  | 'REVIEWED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'DRY_RUN'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'ROLLED_BACK'
  | 'REJECTED'
  | 'STALE'
  | 'CANCELLED'
  | 'FAILED';

export type RecoveryExecutionIntent =
  'execute' | 'dry-run' | 'EXECUTE' | 'DRY_RUN';

export interface HistoricalRecoveryAuditTrail {
  recoveryId: string;
  findingId: string;
  actorId: string;
  action: 'dry-run' | 'approve' | 'execute' | 'rollback';
  status: RecoveryState;
  dryRun: boolean;
  beforeValue: string;
  afterValue?: string;
  currency: string;
  reason: string;
  evidence: string[];
  createdAt: string;
  executedAt?: string;
  rollbackInfo?: {
    previousValue: string;
    rolledBackBy: string;
    rolledBackAt: string;
  };
}

export interface HistoricalRecoveryPlan {
  recoveryId: string;
  findingId: string;
  findingType: string;
  accountId?: string;
  transactionId?: string;
  transferGroupId?: string;
  userId?: string;
  currency: string;
  currentValue: string;
  previousValue?: string;
  proposedValue?: string;
  approvedValue?: string;
  reason: string;
  evidence: string[];
  confidence: number;
  severity: string;
  reversible: boolean;
  requiresManualApproval: boolean;
  state: RecoveryState;
  dryRun: boolean;
  executionIntent?: RecoveryExecutionIntent;
  expectedBalanceImpact?: string;
  expectedTransferImpact?: string;
  currentRecordOwnerId?: string;
  actorId?: string;
  createdAt: string;
  approvedAt?: string;
  executedAt?: string;
  executionEligibility?: string;
  auditTrail: HistoricalRecoveryAuditTrail[];
}

export interface RecoveryExecutionOptions {
  executionIntent?: RecoveryExecutionIntent;
  dryRun?: boolean;
  approved?: boolean;
  simulateFailure?: boolean;
  allowLegacyExecution?: boolean;
  currentValue?: string;
  candidate?: RecoveryCandidate;
}

export interface RecoveryExecutionResult {
  recoveryId: string;
  status: RecoveryState | 'ALREADY_EXECUTED';
  dryRun: boolean;
  mutated: boolean;
  beforeValue: string;
  afterValue?: string;
  currency: string;
  reason: string;
  executionIntent?: RecoveryExecutionIntent;
  idempotencyStatus?: 'FIRST_EXECUTION' | 'ALREADY_EXECUTED';
  auditTrail: HistoricalRecoveryAuditTrail[];
}

export interface HistoricalRecoveryRequest {
  finding: AuditFinding | ProposedRecoveryAction;
  actorId: string;
  currentRecordOwnerId?: string;
  currentValue?: string;
  currentCurrency?: string;
  proposedValue?: string;
  approvedValue?: string;
  dryRun?: boolean;
  stale?: boolean;
  selectedTransferSide?: 'source' | 'destination';
  recoveryId?: string;
  requiresManualApproval?: boolean;
}

export class HistoricalDataRecoveryService {
  static readonly DEFAULT_ENABLED = false;

  static readonly FORBIDDEN_WRITE_OPERATIONS = [
    'update',
    'updateMany',
    'delete',
    'deleteMany',
    '$executeRaw',
    '$executeRawUnsafe',
  ] as const;

  private readonly plans = new Map<string, HistoricalRecoveryPlan>();
  private readonly recoveryLedger = new Map<string, RecoveryExecutionResult>();

  constructor(
    private readonly recoveryEnabled = HistoricalDataRecoveryService.DEFAULT_ENABLED,
    private readonly gateway?: RecoveryWriteGateway,
  ) {}

  private normalizeBigInt(
    value: bigint | number | string | null | undefined,
  ): bigint {
    if (value === null || value === undefined) return 0n;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0n;
      return BigInt(Math.trunc(value));
    }
    const trimmed = String(value).trim();
    if (!trimmed) return 0n;
    return BigInt(trimmed);
  }

  private createRecoveryId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private getCurrency(code?: string): string {
    const normalized = code && code.trim() ? code.trim().toUpperCase() : 'IDR';
    return normalized;
  }

  private parseCurrency(currency: string): string {
    if (!currency || !currency.trim()) return 'IDR';
    const normalized = currency.trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(CURRENCY_SPECS, normalized)) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    return normalized;
  }

  private computeExpectedBalanceImpact(
    currentValue: string,
    proposedValue: string,
  ): string {
    const current = this.normalizeBigInt(currentValue);
    const proposed = this.normalizeBigInt(proposedValue);
    return (proposed - current).toString();
  }

  private createAuditTrail(
    recoveryId: string,
    findingId: string,
    actorId: string,
    action: 'dry-run' | 'approve' | 'execute' | 'rollback',
    status: RecoveryState,
    dryRun: boolean,
    beforeValue: string,
    afterValue: string | undefined,
    currency: string,
    reason: string,
    evidence: string[],
  ): HistoricalRecoveryAuditTrail {
    return {
      recoveryId,
      findingId,
      actorId,
      action,
      status,
      dryRun,
      beforeValue,
      afterValue,
      currency,
      reason,
      evidence,
      createdAt: new Date().toISOString(),
      executedAt: action === 'execute' ? new Date().toISOString() : undefined,
    };
  }

  private isTransferConflict(finding: AuditFinding): boolean {
    const reason = finding.reason.toLowerCase();
    return (
      finding.entity_type === 'transfer' &&
      (reason.includes('mismatch') ||
        reason.includes('cross-currency') ||
        reason.includes('single leg') ||
        reason.includes('different amounts') ||
        reason.includes('same group'))
    );
  }

  private validateFindingPayload(
    finding: AuditFinding | ProposedRecoveryAction,
    currentValue?: string,
    currency?: string,
    currentRecordOwnerId?: string,
    actorId?: string,
    approvedValue?: string,
    selectedTransferSide?: 'source' | 'destination',
    findingUserId?: string,
  ): string[] {
    const warnings: string[] = [];
    const normalizedFinding = finding as Partial<AuditFinding> &
      Partial<ProposedRecoveryAction> & {
        currency?: string;
        current_value?: string;
        proposed_value?: string;
        requires_manual_approval?: boolean;
        userId?: string;
        user_id?: string;
      };

    if (!normalizedFinding || !normalizedFinding.finding_id) {
      warnings.push('Malformed finding: missing finding_id');
    }

    if (!normalizedFinding || !normalizedFinding.reason) {
      warnings.push('Malformed finding: missing reason');
    }

    const targetCurrency = this.parseCurrency(
      currency ?? normalizedFinding.currency ?? 'IDR',
    );
    const findingCurrency = this.getCurrency(
      normalizedFinding.currency ?? 'IDR',
    );
    if (targetCurrency !== findingCurrency) {
      warnings.push('Currency mismatch between target record and finding');
    }

    if (currentValue) {
      const parsedCurrent = this.normalizeBigInt(currentValue);
      const parsedCandidate = this.normalizeBigInt(
        approvedValue ?? normalizedFinding.current_value ?? currentValue,
      );
      if (approvedValue && parsedCurrent === parsedCandidate) {
        warnings.push(
          'Approved value matches current value; no mutation needed',
        );
      }
    }

    if (
      this.isTransferConflict(normalizedFinding as AuditFinding) &&
      !selectedTransferSide
    ) {
      warnings.push(
        'Transfer mismatch requires explicit side selection before recovery',
      );
    }

    if (findingUserId && actorId && findingUserId !== actorId) {
      warnings.push('Actor is not the owner of the offending record');
    }

    if (
      !Object.prototype.hasOwnProperty.call(CURRENCY_SPECS, findingCurrency)
    ) {
      warnings.push('Unsupported currency in finding');
    }

    if (approvedValue) {
      const candidate = this.normalizeBigInt(approvedValue);
      if (
        candidate < 0n &&
        !['USD', 'SGD', 'EUR', 'IDR'].includes(findingCurrency)
      ) {
        warnings.push('Negative value is invalid for the target currency');
      }
    }

    return warnings;
  }

  public isRecoveryEnabled(): boolean {
    return this.recoveryEnabled;
  }

  public buildDryRun(
    request: HistoricalRecoveryRequest,
  ): HistoricalRecoveryPlan {
    const finding = request.finding;
    const payload = this.normalizeFinding(finding);
    const recordCurrency = this.getCurrency(
      request.currentCurrency ?? payload.currency,
    );
    const currentValue = request.currentValue ?? payload.current_value ?? '0';
    const approvedValue =
      request.approvedValue ??
      payload.proposed_value ??
      payload.current_value ??
      currentValue;
    const state = 'DRY_RUN';

    const executionEligibility =
      request.requiresManualApproval === false ||
      payload.requires_manual_approval === false
        ? 'eligible-for-approved-execution'
        : 'manual-approval-required';

    const currencyWarnings = this.validateFindingPayload(
      finding,
      currentValue,
      recordCurrency,
      request.currentRecordOwnerId,
      request.actorId,
      approvedValue,
      request.selectedTransferSide,
      payload.user_id ?? payload.userId,
    );

    if (
      request.currentRecordOwnerId &&
      request.actorId &&
      request.currentRecordOwnerId !== request.actorId
    ) {
      throw new Error(
        'Unauthorized: actor cannot recover a different user record',
      );
    }

    if (currencyWarnings.length > 0) {
      throw new Error(currencyWarnings.join('; '));
    }

    const recoveryId = request.recoveryId ?? this.createRecoveryId('recovery');
    const dryRunAuditTrail = this.createAuditTrail(
      recoveryId,
      payload.finding_id,
      request.actorId,
      'dry-run',
      state,
      true,
      currentValue,
      approvedValue,
      recordCurrency,
      payload.reason,
      payload.evidence,
    );

    const plan: HistoricalRecoveryPlan = {
      recoveryId,
      findingId: payload.finding_id,
      findingType: payload.entity_type,
      accountId:
        payload.entity_type === 'account' ? payload.entity_id : undefined,
      transactionId:
        payload.entity_type === 'transaction' ? payload.entity_id : undefined,
      transferGroupId:
        payload.entity_type === 'transfer' ? payload.entity_id : undefined,
      userId: payload.user_id ?? payload.userId,
      currency: recordCurrency,
      currentValue,
      previousValue: currentValue,
      proposedValue: approvedValue,
      approvedValue,
      reason: payload.reason,
      evidence: payload.evidence,
      confidence: payload.confidence ?? 0,
      severity: payload.severity,
      reversible: true,
      requiresManualApproval: payload.requires_manual_approval ?? true,
      state,
      dryRun: true,
      executionIntent: 'dry-run',
      expectedBalanceImpact:
        payload.entity_type === 'account'
          ? this.computeExpectedBalanceImpact(currentValue, approvedValue)
          : undefined,
      expectedTransferImpact:
        payload.entity_type === 'transfer'
          ? `manual-selection=${request.selectedTransferSide ?? 'required'}`
          : undefined,
      currentRecordOwnerId: request.currentRecordOwnerId,
      actorId: request.actorId,
      createdAt: new Date().toISOString(),
      executionEligibility,
      auditTrail: [dryRunAuditTrail],
    };

    this.plans.set(recoveryId, plan);
    return plan;
  }

  public approveRecovery(
    recoveryId: string,
    actorId: string,
    approvedValue?: string,
    currentValue?: string,
  ): HistoricalRecoveryPlan {
    const plan = this.plans.get(recoveryId);
    if (!plan) {
      throw new Error('Unknown recovery plan');
    }

    if (plan.actorId !== actorId) {
      throw new Error(
        'Unauthorized: only the planning actor can approve this recovery',
      );
    }

    if (plan.state === 'EXECUTED' || plan.state === 'ROLLED_BACK') {
      throw new Error('Recovery already completed and cannot be re-approved');
    }

    const nextApprovedValue =
      approvedValue ?? plan.approvedValue ?? plan.proposedValue;
    if (!nextApprovedValue) {
      throw new Error('Approval requires a valid proposed value');
    }

    const nextApproved = this.normalizeBigInt(nextApprovedValue);
    const reviewedValue = this.normalizeBigInt(plan.currentValue);
    const noAutoTimesHundred =
      nextApproved !== 0n &&
      reviewedValue !== 0n &&
      ((nextApproved / reviewedValue === 100n &&
        nextApproved % reviewedValue === 0n) ||
        (reviewedValue / nextApproved === 100n &&
          reviewedValue % nextApproved === 0n));

    if (noAutoTimesHundred) {
      throw new Error(
        'Automatic ×100 / ÷100 recovery is prohibited without explicit human review',
      );
    }

    const valueMismatch =
      currentValue &&
      this.normalizeBigInt(currentValue) !==
        this.normalizeBigInt(plan.currentValue);
    if (valueMismatch) {
      plan.state = 'STALE';
      plan.auditTrail.push(
        this.createAuditTrail(
          plan.recoveryId,
          plan.findingId,
          actorId,
          'approve',
          'STALE',
          false,
          plan.currentValue,
          nextApprovedValue,
          plan.currency,
          'Current stored value differs from the reviewed value; recovery is stale.',
          ['stale current value detected'],
        ),
      );
      return plan;
    }

    if (plan.requiresManualApproval && !approvedValue) {
      throw new Error('Manual approval is required before execution');
    }

    plan.approvedValue = nextApprovedValue;
    plan.state = 'APPROVED';
    plan.approvedAt = new Date().toISOString();
    plan.auditTrail.push(
      this.createAuditTrail(
        plan.recoveryId,
        plan.findingId,
        actorId,
        'approve',
        'APPROVED',
        false,
        plan.currentValue,
        nextApprovedValue,
        plan.currency,
        'Manual approval recorded for this recovery action.',
        ['manual-approval-present'],
      ),
    );
    return plan;
  }

  private validateExecutionGate(
    plan: HistoricalRecoveryPlan,
    actorId: string,
    options: RecoveryExecutionOptions = {},
  ): { ok: boolean; status: RecoveryState; reason: string } {
    if (plan.actorId !== actorId) {
      return {
        ok: false,
        status: 'REJECTED',
        reason: 'Unauthorized: actor cannot execute this recovery',
      };
    }

    if (plan.state === 'STALE' || plan.state === 'CANCELLED') {
      return {
        ok: false,
        status: 'STALE',
        reason:
          'Recovery is stale or cancelled and cannot execute because observed state no longer matches the reviewed value.',
      };
    }

    if (plan.state === 'EXECUTED') {
      return {
        ok: false,
        status: 'EXECUTED',
        reason: 'Recovery has already been executed and is idempotent.',
      };
    }

    if (plan.state !== 'APPROVED') {
      return {
        ok: false,
        status: 'REJECTED',
        reason:
          'Recovery execution requires explicit approval before any mutation.',
      };
    }

    if (!plan.approvedValue) {
      return {
        ok: false,
        status: 'REJECTED',
        reason: 'Recovery execution requires an approved value.',
      };
    }

    const reviewedValue = this.normalizeBigInt(
      plan.previousValue ?? plan.currentValue,
    );
    const currentValue = this.normalizeBigInt(
      options.currentValue ?? plan.currentValue,
    );
    if (currentValue !== reviewedValue) {
      return {
        ok: false,
        status: 'STALE',
        reason:
          'Current database state differs from the reviewed value; this recovery must be re-reviewed before any mutation.',
      };
    }

    const approvedValue = this.normalizeBigInt(plan.approvedValue);
    const noAutoTimesHundred =
      approvedValue !== 0n &&
      reviewedValue !== 0n &&
      ((approvedValue / reviewedValue === 100n &&
        approvedValue % reviewedValue === 0n) ||
        (reviewedValue / approvedValue === 100n &&
          reviewedValue % approvedValue === 0n));

    if (noAutoTimesHundred) {
      return {
        ok: false,
        status: 'REJECTED',
        reason:
          'Automatic ×100 / ÷100 recovery is prohibited without explicit human review and a new approved finding.',
      };
    }

    if (options.simulateFailure) {
      return {
        ok: false,
        status: 'FAILED',
        reason:
          'Simulated transaction failure: no mutation was committed and the recovery remains in a failed state.',
      };
    }

    return {
      ok: true,
      status: 'EXECUTING',
      reason: 'Execution gate passed.',
    };
  }

  public executeRecovery(
    recoveryId: string,
    actorId: string,
    options: RecoveryExecutionOptions = {},
  ): RecoveryExecutionResult {
    const plan = this.plans.get(recoveryId);
    if (!plan) {
      throw new Error('Unknown recovery plan');
    }

    const existing = this.recoveryLedger.get(recoveryId);
    if (
      existing?.status === 'EXECUTED' ||
      existing?.idempotencyStatus === 'ALREADY_EXECUTED'
    ) {
      return {
        ...existing,
        mutated: false,
        idempotencyStatus: 'ALREADY_EXECUTED',
        reason:
          'ALREADY_EXECUTED: this recovery was already applied once and cannot be re-applied.',
      };
    }

    if (!this.recoveryEnabled) {
      const result: RecoveryExecutionResult = {
        recoveryId,
        status: 'REJECTED',
        dryRun: false,
        mutated: false,
        beforeValue: plan.currentValue,
        currency: plan.currency,
        reason:
          'Historical recovery is disabled by configuration; execution refused.',
        auditTrail: [...plan.auditTrail],
      };
      plan.state = 'REJECTED';
      this.recoveryLedger.set(recoveryId, result);
      return result;
    }

    const executionIntent = options.executionIntent
      ? options.executionIntent.toLowerCase()
      : options.dryRun === true
        ? 'dry-run'
        : 'execute';

    if (executionIntent === 'dry-run' || options.dryRun === true) {
      const result: RecoveryExecutionResult = {
        recoveryId,
        status: 'REJECTED',
        dryRun: true,
        mutated: false,
        beforeValue: plan.currentValue,
        currency: plan.currency,
        reason:
          'Dry-run mode cannot execute a recovery; an explicit approved execution intent is required.',
        executionIntent: 'dry-run',
        auditTrail: [...plan.auditTrail],
      };
      plan.state = 'REJECTED';
      this.recoveryLedger.set(recoveryId, result);
      return result;
    }

    const gate = this.validateExecutionGate(plan, actorId, options);
    if (!gate.ok) {
      const result: RecoveryExecutionResult = {
        recoveryId,
        status: gate.status,
        dryRun: false,
        mutated: false,
        beforeValue: plan.currentValue,
        afterValue: plan.currentValue,
        currency: plan.currency,
        reason: gate.reason,
        executionIntent: 'execute',
        auditTrail: [...plan.auditTrail],
      };
      plan.state =
        gate.status === 'STALE'
          ? 'STALE'
          : gate.status === 'FAILED'
            ? 'FAILED'
            : 'REJECTED';
      this.recoveryLedger.set(recoveryId, result);
      return result;
    }

    const afterValue =
      plan.approvedValue ?? plan.proposedValue ?? plan.currentValue;
    const previousValue = plan.previousValue ?? plan.currentValue;
    plan.previousValue = previousValue;
    plan.currentValue = afterValue;
    plan.state = 'EXECUTING';

    const reason =
      'Approved recovery executed under the controlled historical recovery gate; no live production mutation occurred in this safe execution layer.';
    const executionAudit = this.createAuditTrail(
      plan.recoveryId,
      plan.findingId,
      actorId,
      'execute',
      'EXECUTED',
      false,
      previousValue,
      afterValue,
      plan.currency,
      reason,
      [
        'execution-approved',
        'controlled-execution-intent',
        'transaction-safe-simulation',
      ],
    );

    plan.state = 'EXECUTED';
    plan.executedAt = new Date().toISOString();
    plan.auditTrail.push(executionAudit);
    const result: RecoveryExecutionResult = {
      recoveryId,
      status: 'EXECUTED',
      dryRun: false,
      mutated: true,
      beforeValue: previousValue,
      afterValue,
      currency: plan.currency,
      reason,
      executionIntent: 'execute',
      idempotencyStatus: 'FIRST_EXECUTION',
      auditTrail: [...plan.auditTrail],
    };
    this.recoveryLedger.set(recoveryId, result);
    return result;
  }

  public async executeRecoveryPersistent(
    recoveryId: string,
    actorId: string,
    options: RecoveryExecutionOptions = {},
  ): Promise<RecoveryExecutionResult> {
    const plan = this.plans.get(recoveryId);
    if (!plan) {
      throw new Error('Unknown recovery plan');
    }

    const existing = this.recoveryLedger.get(recoveryId);
    if (
      existing?.status === 'EXECUTED' ||
      existing?.idempotencyStatus === 'ALREADY_EXECUTED'
    ) {
      return {
        ...existing,
        mutated: false,
        idempotencyStatus: 'ALREADY_EXECUTED',
        reason:
          'ALREADY_EXECUTED: this recovery was already applied once and cannot be re-applied.',
      };
    }

    if (!this.gateway) {
      return this.buildRejectedResult(
        plan,
        'Persistent recovery execution requires a write gateway; no gateway is configured.',
      );
    }
    if (!this.recoveryEnabled) {
      return this.buildRejectedResult(
        plan,
        'Historical recovery is disabled by configuration; execution refused.',
      );
    }
    if (!options.candidate) {
      return this.buildRejectedResult(
        plan,
        'Persistent recovery execution requires the reviewed candidate snapshot captured at approval time.',
      );
    }
    if (plan.findingType !== 'transaction') {
      return this.buildRejectedResult(
        plan,
        'Persistent write-back supports transaction recoveries only; account and transfer findings require manual reconciliation.',
      );
    }
    if (!plan.evidence || plan.evidence.length === 0) {
      return this.buildRejectedResult(
        plan,
        'Recovery execution requires preserved evidence; the candidate finding carries none.',
      );
    }

    const gate = this.validateExecutionGate(plan, actorId, options);
    if (!gate.ok) {
      const result: RecoveryExecutionResult = {
        recoveryId,
        status: gate.status,
        dryRun: false,
        mutated: false,
        beforeValue: plan.currentValue,
        afterValue: plan.currentValue,
        currency: plan.currency,
        reason: gate.reason,
        executionIntent: 'execute',
        auditTrail: [...plan.auditTrail],
      };
      plan.state =
        gate.status === 'STALE'
          ? 'STALE'
          : gate.status === 'FAILED'
            ? 'FAILED'
            : 'REJECTED';
      this.recoveryLedger.set(recoveryId, result);
      return result;
    }

    const beforeValue = this.normalizeBigInt(plan.currentValue);
    const afterValue = this.normalizeBigInt(
      plan.approvedValue ?? plan.proposedValue ?? plan.currentValue,
    );

    const outcome = await this.gateway.applyRecovery({
      recoveryId: plan.recoveryId,
      findingId: plan.findingId,
      actorId,
      approvedBy: plan.actorId ?? actorId,
      currency: plan.currency,
      beforeValueCents: beforeValue,
      afterValueCents: afterValue,
      candidate: options.candidate,
      evidence: plan.evidence,
    });

    return this.mapApplyOutcome(plan, actorId, outcome);
  }

  public async rollbackRecoveryPersistent(
    recoveryId: string,
    actorId: string,
  ): Promise<RecoveryExecutionResult> {
    const plan = this.plans.get(recoveryId);
    if (!plan) {
      throw new Error('Unknown recovery plan');
    }

    const existing = this.recoveryLedger.get(recoveryId);
    if (existing?.status === 'ROLLED_BACK') {
      throw new Error(
        'Recovery has already been rolled back and cannot be rolled back again',
      );
    }

    if (plan.actorId !== actorId) {
      throw new Error('Unauthorized: actor cannot roll back this recovery');
    }

    if (!this.gateway) {
      return this.buildRejectedResult(
        plan,
        'Persistent rollback requires a write gateway; no gateway is configured.',
      );
    }
    if (!this.recoveryEnabled) {
      return this.buildRejectedResult(
        plan,
        'Historical recovery is disabled by configuration; rollback refused.',
      );
    }

    const outcome = await this.gateway.rollbackRecovery({
      recoveryId,
      actorId,
    });
    return this.mapRollbackOutcome(plan, actorId, outcome);
  }

  private buildRejectedResult(
    plan: HistoricalRecoveryPlan,
    reason: string,
  ): RecoveryExecutionResult {
    const result: RecoveryExecutionResult = {
      recoveryId: plan.recoveryId,
      status: 'REJECTED',
      dryRun: false,
      mutated: false,
      beforeValue: plan.currentValue,
      afterValue: plan.currentValue,
      currency: plan.currency,
      reason,
      executionIntent: 'execute',
      auditTrail: [...plan.auditTrail],
    };
    plan.state = 'REJECTED';
    this.recoveryLedger.set(plan.recoveryId, result);
    return result;
  }

  private mapApplyOutcome(
    plan: HistoricalRecoveryPlan,
    actorId: string,
    outcome: RecoveryApplyOutcome,
  ): RecoveryExecutionResult {
    const previousValue = plan.currentValue;
    const afterValue = outcome.afterValueCents.toString();
    const audit = this.createAuditTrail(
      plan.recoveryId,
      plan.findingId,
      actorId,
      'execute',
      'EXECUTED',
      false,
      previousValue,
      afterValue,
      plan.currency,
      outcome.reason,
      [
        `persisted-ledger-status=${outcome.ledgerStatus ?? 'UNKNOWN'}`,
        `source-fingerprint=${outcome.sourceFingerprint}`,
        'durable-ledger-entry-committed',
      ],
    );
    plan.auditTrail.push(audit);

    if (outcome.status === 'APPLIED') {
      plan.state = 'EXECUTED';
      plan.executedAt = new Date().toISOString();
      plan.currentValue = afterValue;
      const result: RecoveryExecutionResult = {
        recoveryId: plan.recoveryId,
        status: 'EXECUTED',
        dryRun: false,
        mutated: true,
        beforeValue: previousValue,
        afterValue,
        currency: plan.currency,
        reason: outcome.reason,
        executionIntent: 'execute',
        idempotencyStatus: 'FIRST_EXECUTION',
        auditTrail: [...plan.auditTrail],
      };
      this.recoveryLedger.set(plan.recoveryId, result);
      return result;
    }

    if (outcome.status === 'ALREADY_EXECUTED') {
      const result: RecoveryExecutionResult = {
        recoveryId: plan.recoveryId,
        status: 'EXECUTED',
        dryRun: false,
        mutated: false,
        beforeValue: previousValue,
        afterValue: outcome.afterValueCents.toString(),
        currency: plan.currency,
        reason: outcome.reason,
        executionIntent: 'execute',
        idempotencyStatus: 'ALREADY_EXECUTED',
        auditTrail: [...plan.auditTrail],
      };
      this.recoveryLedger.set(plan.recoveryId, result);
      return result;
    }

    plan.state =
      outcome.status === 'STALE'
        ? 'STALE'
        : outcome.status === 'FAILED'
          ? 'FAILED'
          : 'REJECTED';
    const result: RecoveryExecutionResult = {
      recoveryId: plan.recoveryId,
      status: plan.state,
      dryRun: false,
      mutated: false,
      beforeValue: previousValue,
      afterValue: previousValue,
      currency: plan.currency,
      reason: outcome.reason,
      executionIntent: 'execute',
      auditTrail: [...plan.auditTrail],
    };
    this.recoveryLedger.set(plan.recoveryId, result);
    return result;
  }

  private mapRollbackOutcome(
    plan: HistoricalRecoveryPlan,
    actorId: string,
    outcome: RecoveryRollbackOutcome,
  ): RecoveryExecutionResult {
    const executedValue =
      plan.approvedValue ?? plan.proposedValue ?? plan.currentValue;
    const rollbackValue = outcome.afterValueCents.toString();

    if (outcome.status === 'ROLLED_BACK') {
      const audit = this.createAuditTrail(
        plan.recoveryId,
        plan.findingId,
        actorId,
        'rollback',
        'ROLLED_BACK',
        false,
        executedValue,
        rollbackValue,
        plan.currency,
        outcome.reason,
        [
          `persisted-ledger-status=${outcome.ledgerStatus ?? 'UNKNOWN'}`,
          `source-fingerprint=${outcome.sourceFingerprint}`,
          'durable-ledger-entry-updated',
        ],
      );
      plan.auditTrail.push(audit);
      plan.state = 'ROLLED_BACK';
      plan.currentValue = rollbackValue;
      const result: RecoveryExecutionResult = {
        recoveryId: plan.recoveryId,
        status: 'ROLLED_BACK',
        dryRun: false,
        mutated: true,
        beforeValue: executedValue,
        afterValue: rollbackValue,
        currency: plan.currency,
        reason: outcome.reason,
        executionIntent: 'execute',
        auditTrail: [...plan.auditTrail],
      };
      this.recoveryLedger.set(plan.recoveryId, result);
      return result;
    }

    if (outcome.status === 'ALREADY_ROLLED_BACK') {
      const result: RecoveryExecutionResult = {
        recoveryId: plan.recoveryId,
        status: 'ROLLED_BACK',
        dryRun: false,
        mutated: false,
        beforeValue: executedValue,
        afterValue: rollbackValue,
        currency: plan.currency,
        reason: outcome.reason,
        executionIntent: 'execute',
        auditTrail: [...plan.auditTrail],
      };
      this.recoveryLedger.set(plan.recoveryId, result);
      return result;
    }

    plan.state =
      outcome.status === 'STALE'
        ? 'STALE'
        : outcome.status === 'FAILED'
          ? 'FAILED'
          : 'REJECTED';
    const result: RecoveryExecutionResult = {
      recoveryId: plan.recoveryId,
      status: plan.state,
      dryRun: false,
      mutated: false,
      beforeValue: executedValue,
      afterValue: executedValue,
      currency: plan.currency,
      reason: outcome.reason,
      executionIntent: 'execute',
      auditTrail: [...plan.auditTrail],
    };
    this.recoveryLedger.set(plan.recoveryId, result);
    return result;
  }

  public rollbackRecovery(
    recoveryId: string,
    actorId: string,
  ): RecoveryExecutionResult {
    const plan = this.plans.get(recoveryId);
    if (!plan) {
      throw new Error('Unknown recovery plan');
    }

    const existing = this.recoveryLedger.get(recoveryId);
    if (existing?.status === 'ROLLED_BACK') {
      throw new Error(
        'Recovery has already been rolled back and cannot be rolled back again',
      );
    }

    if (plan.actorId !== actorId) {
      throw new Error('Unauthorized: actor cannot roll back this recovery');
    }

    if (plan.state === 'STALE') {
      const result: RecoveryExecutionResult = {
        recoveryId,
        status: 'STALE',
        dryRun: false,
        mutated: false,
        beforeValue: plan.currentValue,
        afterValue: plan.currentValue,
        currency: plan.currency,
        reason:
          'Rollback is stale because the current state no longer matches the executed recovery state.',
        auditTrail: [...plan.auditTrail],
      };
      plan.state = 'STALE';
      this.recoveryLedger.set(recoveryId, result);
      return result;
    }

    const originalValue = plan.previousValue ?? plan.currentValue;
    const executedValue =
      plan.approvedValue ?? plan.proposedValue ?? plan.currentValue;
    const rollbackValue = originalValue;

    plan.currentValue = rollbackValue;
    const result: RecoveryExecutionResult = {
      recoveryId,
      status: 'ROLLED_BACK',
      dryRun: false,
      mutated: true,
      beforeValue: executedValue,
      afterValue: rollbackValue,
      currency: plan.currency,
      reason:
        'Rollback restored the original recorded value without a real database mutation in this safe simulation.',
      executionIntent: 'execute',
      auditTrail: [
        ...plan.auditTrail,
        {
          recoveryId,
          findingId: plan.findingId,
          actorId,
          action: 'rollback',
          status: 'ROLLED_BACK',
          dryRun: false,
          beforeValue: executedValue,
          afterValue: rollbackValue,
          currency: plan.currency,
          reason: 'Rollback performed to restore the original value.',
          evidence: ['rollback-restored-original-value'],
          createdAt: new Date().toISOString(),
          executedAt: new Date().toISOString(),
          rollbackInfo: {
            previousValue: originalValue,
            rolledBackBy: actorId,
            rolledBackAt: new Date().toISOString(),
          },
        },
      ],
    };

    plan.state = 'ROLLED_BACK';
    this.recoveryLedger.set(recoveryId, result);
    return result;
  }

  public normalizeFinding(
    finding: AuditFinding | ProposedRecoveryAction,
  ): AuditFinding & {
    current_value?: string;
    proposed_value?: string;
    requires_manual_approval?: boolean;
    userId?: string;
    user_id?: string;
  } {
    const safeFinding = finding as Partial<AuditFinding> &
      Partial<ProposedRecoveryAction> & {
        currency?: string;
        current_value?: string;
        proposed_value?: string;
        requires_manual_approval?: boolean;
        requiresManualApproval?: boolean;
        userId?: string;
        user_id?: string;
      };

    const base = {
      finding_id: safeFinding.finding_id,
      entity_type: 'finding',
      entity_id: safeFinding.finding_id,
      user_id: safeFinding.user_id ?? safeFinding.userId ?? 'unknown',
      currency: this.getCurrency(safeFinding.currency ?? 'IDR'),
      stored_value: '0',
      severity: 'MEDIUM',
      status: 'SUSPICIOUS',
      confidence: 0.5,
      reason: safeFinding.reason ?? 'Manual review required.',
      evidence: safeFinding.evidence ?? [],
      recommended_action: 'Manual review required.',
      current_value:
        safeFinding.current_value ?? safeFinding.proposed_value ?? '0',
      proposed_value: safeFinding.proposed_value,
      requires_manual_approval:
        safeFinding.requires_manual_approval ??
        safeFinding.requiresManualApproval ??
        true,
      ...(safeFinding as Partial<AuditFinding>),
    } as AuditFinding & {
      current_value?: string;
      proposed_value?: string;
      requires_manual_approval?: boolean;
      userId?: string;
      user_id?: string;
    };

    if (!base.entity_type || base.entity_type === 'finding') {
      base.entity_type = 'transaction';
    }
    if (!base.currency) {
      base.currency = 'IDR';
    }
    return base;
  }
}
