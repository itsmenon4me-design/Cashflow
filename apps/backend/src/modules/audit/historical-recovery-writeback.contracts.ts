import crypto from 'crypto';

export const RECOVERY_LEDGER_STATUS = {
  EXECUTING: 'EXECUTING',
  APPLIED: 'APPLIED',
  ROLLED_BACK: 'ROLLED_BACK',
  REJECTED: 'REJECTED',
  STALE: 'STALE',
  FAILED: 'FAILED',
} as const;

export type RecoveryLedgerStatus =
  (typeof RECOVERY_LEDGER_STATUS)[keyof typeof RECOVERY_LEDGER_STATUS];

export type RecoveryEntityType = 'transaction' | 'account' | 'transfer';

export interface RecoveryCandidate {
  entityType: RecoveryEntityType;
  entityId: string;
  userId: string;
  accountId: string;
  currency: string;
  transactionType: string;
  transactionDate: Date;
  amountCents: bigint;
}

export interface RecoveryLedgerEntry {
  recoveryId: string;
  findingId: string;
  entityType: string;
  entityId: string;
  userId: string;
  currency: string;
  status: RecoveryLedgerStatus;
  beforeValueCents: bigint;
  afterValueCents: bigint;
  approvedBy?: string | null;
  executedBy?: string | null;
  rolledBackBy?: string | null;
  rollbackStatus?: string | null;
  sourceFingerprint: string;
  evidence: string[];
  errorReason?: string | null;
  approvedAt?: Date | null;
  executedAt?: Date | null;
  rolledBackAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RecoveryApplyRequest {
  recoveryId: string;
  findingId: string;
  actorId: string;
  approvedBy: string;
  currency: string;
  beforeValueCents: bigint;
  afterValueCents: bigint;
  candidate: RecoveryCandidate;
  evidence: string[];
}

export type RecoveryApplyStatus =
  'APPLIED' | 'ALREADY_EXECUTED' | 'REJECTED' | 'STALE' | 'FAILED';

export interface RecoveryApplyOutcome {
  status: RecoveryApplyStatus;
  mutated: boolean;
  recoveryId: string;
  beforeValueCents: bigint;
  afterValueCents: bigint;
  currency: string;
  reason: string;
  sourceFingerprint: string;
  ledgerStatus?: RecoveryLedgerStatus | null;
  newBalanceCents?: bigint;
}

export interface RecoveryRollbackRequest {
  recoveryId: string;
  actorId: string;
}

export type RecoveryRollbackStatus =
  'ROLLED_BACK' | 'ALREADY_ROLLED_BACK' | 'REJECTED' | 'STALE' | 'FAILED';

export interface RecoveryRollbackOutcome {
  status: RecoveryRollbackStatus;
  mutated: boolean;
  recoveryId: string;
  beforeValueCents: bigint;
  afterValueCents: bigint;
  currency: string;
  reason: string;
  sourceFingerprint: string;
  ledgerStatus?: RecoveryLedgerStatus | null;
}

export interface RecoveryWriteGateway {
  applyRecovery(request: RecoveryApplyRequest): Promise<RecoveryApplyOutcome>;
  rollbackRecovery(
    request: RecoveryRollbackRequest,
  ): Promise<RecoveryRollbackOutcome>;
}

export function computeSourceFingerprint(candidate: RecoveryCandidate): string {
  const canonical = {
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    userId: candidate.userId,
    accountId: candidate.accountId,
    currency: candidate.currency.toUpperCase(),
    transactionType: candidate.transactionType,
    transactionDate: candidate.transactionDate.toISOString(),
    amountCents: candidate.amountCents.toString(),
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

export class RecoveryWriteRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryWriteRejectedError';
  }
}

export class RecoveryStaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryStaleError';
  }
}
