import {
  PrismaClient,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client';
import { AuditLogService } from '../audit-logs/services/audit-log.service';
import {
  computeSourceFingerprint,
  RecoveryApplyOutcome,
  RecoveryApplyRequest,
  RecoveryLedgerStatus,
  RecoveryRollbackOutcome,
  RecoveryRollbackRequest,
  RecoveryStaleError,
  RecoveryWriteGateway,
  RecoveryWriteRejectedError,
  RECOVERY_LEDGER_STATUS,
} from './historical-recovery-writeback.contracts';

const ACTIVE_LEDGER_STATUSES: RecoveryLedgerStatus[] = [
  RECOVERY_LEDGER_STATUS.EXECUTING,
  RECOVERY_LEDGER_STATUS.APPLIED,
];

const AUDIT_ACTION_EXECUTED = 'HISTORICAL_RECOVERY_EXECUTED';
const AUDIT_ACTION_ROLLED_BACK = 'HISTORICAL_RECOVERY_ROLLED_BACK';

export class HistoricalRecoveryWriteGateway implements RecoveryWriteGateway {
  static readonly FORBIDDEN_WRITE_OPERATIONS = [
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    '$executeRaw',
    '$executeRawUnsafe',
    '$queryRaw',
    '$queryRawUnsafe',
    '$transaction',
  ] as const;

  private readonly forbiddenWriteOperations: ReadonlySet<string> = new Set(
    HistoricalRecoveryWriteGateway.FORBIDDEN_WRITE_OPERATIONS,
  );

  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) => fn(this.guardTx(tx)));
  }

  private guardTx(tx: Prisma.TransactionClient): Prisma.TransactionClient {
    const seen = new WeakSet<object>();
    return this.guardObject(tx, seen);
  }

  private guardObject<T>(value: T, seen: WeakSet<object>): T {
    if (
      value === null ||
      (typeof value !== 'object' && typeof value !== 'function')
    ) {
      return value;
    }
    const target = value as object;
    if (seen.has(target)) {
      return value;
    }
    seen.add(target);
    return new Proxy(target, {
      get: (obj, prop, receiver) => {
        if (
          typeof prop === 'string' &&
          this.forbiddenWriteOperations.has(prop)
        ) {
          throw new RecoveryWriteRejectedError(
            `Forbidden Prisma write operation on recovery write gateway: ${prop}`,
          );
        }
        const result = Reflect.get(obj, prop, receiver) as unknown;
        if (result !== null && typeof result === 'object') {
          return this.guardObject(result, seen) as T;
        }
        return result;
      },
    }) as T;
  }

  async applyRecovery(
    request: RecoveryApplyRequest,
  ): Promise<RecoveryApplyOutcome> {
    const sourceFingerprint = computeSourceFingerprint(request.candidate);
    const failed = (reason: string): RecoveryApplyOutcome => ({
      status: 'FAILED',
      mutated: false,
      recoveryId: request.recoveryId,
      beforeValueCents: request.beforeValueCents,
      afterValueCents: request.afterValueCents,
      currency: request.currency,
      reason,
      sourceFingerprint,
    });
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.historicalRecoveryLedger.findUnique({
          where: { recovery_id: request.recoveryId },
        });
        if (existing) {
          return {
            status: 'ALREADY_EXECUTED' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: existing.before_value_cents,
            afterValueCents: existing.after_value_cents,
            currency: existing.currency,
            reason:
              'ALREADY_EXECUTED: this recovery operation already has a durable ledger entry and cannot be re-applied.',
            sourceFingerprint: existing.source_fingerprint,
            ledgerStatus: existing.status as RecoveryLedgerStatus,
          };
        }

        const activeForEntity = await tx.historicalRecoveryLedger.findFirst({
          where: {
            entity_type: request.candidate.entityType,
            entity_id: request.candidate.entityId,
            status: { in: ACTIVE_LEDGER_STATUSES },
          },
        });
        if (activeForEntity) {
          throw new RecoveryWriteRejectedError(
            `Another recovery operation (${activeForEntity.recovery_id}) is active for record ${request.candidate.entityId}; concurrent recovery is not permitted.`,
          );
        }

        await tx.historicalRecoveryLedger.create({
          data: {
            recovery_id: request.recoveryId,
            finding_id: request.findingId,
            entity_type: request.candidate.entityType,
            entity_id: request.candidate.entityId,
            user_id: request.candidate.userId,
            currency: request.currency,
            status: RECOVERY_LEDGER_STATUS.EXECUTING,
            before_value_cents: request.beforeValueCents,
            after_value_cents: request.afterValueCents,
            approved_by: request.approvedBy,
            source_fingerprint: sourceFingerprint,
            evidence:
              request.evidence.length > 0 ? request.evidence : undefined,
            approved_at: new Date(),
          },
        });

        const target = await tx.transaction.findUnique({
          where: { id: request.candidate.entityId },
        });
        if (!target) {
          throw new RecoveryWriteRejectedError(
            `Recovery target transaction does not exist: ${request.candidate.entityId}`,
          );
        }
        const account = await tx.account.findUnique({
          where: { id: target.account_id },
        });
        if (!account) {
          throw new RecoveryWriteRejectedError(
            `Recovery target account does not exist: ${target.account_id}`,
          );
        }

        const dateMatches =
          target.transaction_date.getTime() ===
          request.candidate.transactionDate.getTime();
        const staleReason = this.detectStale(
          target,
          account,
          request,
          dateMatches,
        );
        if (staleReason) {
          throw new RecoveryStaleError(staleReason);
        }

        const cas = await tx.transaction.updateMany({
          where: {
            id: target.id,
            amount_cents: request.beforeValueCents,
            deleted_at: null,
          },
          data: { amount_cents: request.afterValueCents },
        });
        if (cas.count !== 1) {
          throw new RecoveryStaleError(
            'Concurrent modification detected: the recovery target no longer matches the approved reviewed value.',
          );
        }

        const newBalance = await this.recalculateAccountBalance(
          tx,
          target.account_id,
        );

        await tx.historicalRecoveryLedger.update({
          where: { recovery_id: request.recoveryId },
          data: {
            status: RECOVERY_LEDGER_STATUS.APPLIED,
            executed_by: request.actorId,
            executed_at: new Date(),
            error_reason: null,
          },
        });

        await this.recordAudit(tx, {
          userId: request.candidate.userId,
          action: AUDIT_ACTION_EXECUTED,
          entityId: request.candidate.entityId,
          recoveryId: request.recoveryId,
          findingId: request.findingId,
          actorId: request.actorId,
          beforeValueCents: request.beforeValueCents,
          afterValueCents: request.afterValueCents,
          sourceFingerprint,
          ledgerStatus: RECOVERY_LEDGER_STATUS.APPLIED,
        });

        return {
          status: 'APPLIED' as const,
          mutated: true,
          recoveryId: request.recoveryId,
          beforeValueCents: request.beforeValueCents,
          afterValueCents: request.afterValueCents,
          currency: request.currency,
          reason:
            'Approved recovery executed under the controlled historical recovery gate; durable ledger entry persisted.',
          sourceFingerprint,
          ledgerStatus: RECOVERY_LEDGER_STATUS.APPLIED,
          newBalanceCents: newBalance,
        };
      });
      return outcome;
    } catch (error) {
      if (error instanceof RecoveryStaleError) {
        return {
          status: 'STALE',
          mutated: false,
          recoveryId: request.recoveryId,
          beforeValueCents: request.beforeValueCents,
          afterValueCents: request.afterValueCents,
          currency: request.currency,
          reason: error.message,
          sourceFingerprint,
        };
      }
      if (error instanceof RecoveryWriteRejectedError) {
        return {
          status: 'REJECTED',
          mutated: false,
          recoveryId: request.recoveryId,
          beforeValueCents: request.beforeValueCents,
          afterValueCents: request.afterValueCents,
          currency: request.currency,
          reason: error.message,
          sourceFingerprint,
        };
      }
      if (this.isUniqueConstraintViolation(error)) {
        return {
          status: 'ALREADY_EXECUTED',
          mutated: false,
          recoveryId: request.recoveryId,
          beforeValueCents: request.beforeValueCents,
          afterValueCents: request.afterValueCents,
          currency: request.currency,
          reason:
            'ALREADY_EXECUTED: a concurrent execution committed the durable ledger entry first.',
          sourceFingerprint,
        };
      }
      return failed(
        `Recovery apply aborted and fully rolled back: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async rollbackRecovery(
    request: RecoveryRollbackRequest,
  ): Promise<RecoveryRollbackOutcome> {
    const failed = (reason: string): RecoveryRollbackOutcome => ({
      status: 'FAILED',
      mutated: false,
      recoveryId: request.recoveryId,
      beforeValueCents: 0n,
      afterValueCents: 0n,
      currency: 'IDR',
      reason,
      sourceFingerprint: '',
    });
    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const ledger = await tx.historicalRecoveryLedger.findUnique({
          where: { recovery_id: request.recoveryId },
        });
        if (!ledger) {
          return {
            status: 'REJECTED' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: 0n,
            afterValueCents: 0n,
            currency: 'IDR',
            reason:
              'Unknown recovery operation: no durable ledger entry exists for this recovery.',
            sourceFingerprint: '',
          };
        }
        if (ledger.status === RECOVERY_LEDGER_STATUS.ROLLED_BACK) {
          return {
            status: 'ALREADY_ROLLED_BACK' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: ledger.before_value_cents,
            afterValueCents: ledger.before_value_cents,
            currency: ledger.currency,
            reason:
              'ALREADY_ROLLED_BACK: this recovery was already rolled back and cannot be rolled back again.',
            sourceFingerprint: ledger.source_fingerprint,
            ledgerStatus: RECOVERY_LEDGER_STATUS.ROLLED_BACK,
          };
        }
        if (ledger.status !== RECOVERY_LEDGER_STATUS.APPLIED) {
          return {
            status: 'REJECTED' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: ledger.before_value_cents,
            afterValueCents: ledger.after_value_cents,
            currency: ledger.currency,
            reason: `Recovery is not in APPLIED state (${ledger.status}); rollback refused.`,
            sourceFingerprint: ledger.source_fingerprint,
            ledgerStatus: ledger.status as RecoveryLedgerStatus,
          };
        }

        const target = await tx.transaction.findUnique({
          where: { id: ledger.entity_id },
        });
        if (!target || target.deleted_at !== null) {
          return {
            status: 'STALE' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: ledger.before_value_cents,
            afterValueCents: ledger.after_value_cents,
            currency: ledger.currency,
            reason:
              'Rollback is stale: the recovery target is missing or deleted and cannot be verified.',
            sourceFingerprint: ledger.source_fingerprint,
            ledgerStatus: ledger.status as RecoveryLedgerStatus,
          };
        }
        if (target.amount_cents !== ledger.after_value_cents) {
          return {
            status: 'STALE' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: ledger.before_value_cents,
            afterValueCents: ledger.after_value_cents,
            currency: ledger.currency,
            reason:
              'Rollback is stale: the recovery target amount no longer matches the executed after-value.',
            sourceFingerprint: ledger.source_fingerprint,
            ledgerStatus: ledger.status as RecoveryLedgerStatus,
          };
        }

        const cas = await tx.transaction.updateMany({
          where: {
            id: ledger.entity_id,
            amount_cents: ledger.after_value_cents,
            deleted_at: null,
          },
          data: { amount_cents: ledger.before_value_cents },
        });
        if (cas.count !== 1) {
          return {
            status: 'STALE' as const,
            mutated: false,
            recoveryId: request.recoveryId,
            beforeValueCents: ledger.before_value_cents,
            afterValueCents: ledger.after_value_cents,
            currency: ledger.currency,
            reason:
              'Rollback is stale: concurrent modification prevented the exact reversal.',
            sourceFingerprint: ledger.source_fingerprint,
            ledgerStatus: ledger.status as RecoveryLedgerStatus,
          };
        }

        await this.recalculateAccountBalance(tx, target.account_id);

        await tx.historicalRecoveryLedger.update({
          where: { recovery_id: request.recoveryId },
          data: {
            status: RECOVERY_LEDGER_STATUS.ROLLED_BACK,
            rollback_status: RECOVERY_LEDGER_STATUS.ROLLED_BACK,
            rolled_back_by: request.actorId,
            rolled_back_at: new Date(),
          },
        });

        await this.recordAudit(tx, {
          userId: ledger.user_id,
          action: AUDIT_ACTION_ROLLED_BACK,
          entityId: ledger.entity_id,
          recoveryId: request.recoveryId,
          findingId: ledger.finding_id,
          actorId: request.actorId,
          beforeValueCents: ledger.before_value_cents,
          afterValueCents: ledger.after_value_cents,
          sourceFingerprint: ledger.source_fingerprint,
          ledgerStatus: RECOVERY_LEDGER_STATUS.ROLLED_BACK,
        });

        return {
          status: 'ROLLED_BACK' as const,
          mutated: true,
          recoveryId: request.recoveryId,
          beforeValueCents: ledger.after_value_cents,
          afterValueCents: ledger.before_value_cents,
          currency: ledger.currency,
          reason:
            'Rollback restored the original recorded value under the controlled historical recovery gate; durable ledger entry updated.',
          sourceFingerprint: ledger.source_fingerprint,
          ledgerStatus: RECOVERY_LEDGER_STATUS.ROLLED_BACK,
        };
      });
      return outcome;
    } catch (error) {
      if (error instanceof RecoveryStaleError) {
        return {
          status: 'STALE',
          mutated: false,
          recoveryId: request.recoveryId,
          beforeValueCents: 0n,
          afterValueCents: 0n,
          currency: 'IDR',
          reason: error.message,
          sourceFingerprint: '',
        };
      }
      return failed(
        `Recovery rollback aborted and fully rolled back: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private detectStale(
    target: {
      amount_cents: bigint;
      user_id: string;
      account_id: string;
      transaction_type: string;
      transaction_date: Date;
      deleted_at: Date | null;
    },
    account: { currency: string },
    request: RecoveryApplyRequest,
    dateMatches: boolean,
  ): string | null {
    if (target.amount_cents !== request.beforeValueCents) {
      return 'Stale recovery candidate: the stored amount no longer matches the approved reviewed value.';
    }
    if (target.user_id !== request.candidate.userId) {
      return 'Stale recovery candidate: the record owner no longer matches the reviewed user.';
    }
    if (target.account_id !== request.candidate.accountId) {
      return 'Stale recovery candidate: the owning account no longer matches the reviewed account.';
    }
    if (
      target.transaction_type.toUpperCase() !==
      request.candidate.transactionType.toUpperCase()
    ) {
      return 'Stale recovery candidate: the transaction type no longer matches the reviewed type.';
    }
    if (!dateMatches) {
      return 'Stale recovery candidate: the transaction date no longer matches the reviewed date.';
    }
    if (target.deleted_at !== null) {
      return 'Stale recovery candidate: the record has been deleted.';
    }
    if (
      account.currency.toUpperCase() !==
      request.candidate.currency.toUpperCase()
    ) {
      return 'Stale recovery candidate: the account currency no longer matches the reviewed currency.';
    }
    return null;
  }

  private async recalculateAccountBalance(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<bigint> {
    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new RecoveryWriteRejectedError(
        `Cannot recalculate balance for missing account: ${accountId}`,
      );
    }

    const [income, expense] = await Promise.all([
      tx.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
        },
        _sum: { amount_cents: true },
      }),
      tx.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
        },
        _sum: { amount_cents: true },
      }),
    ]);

    const opening =
      typeof account.opening_balance_cents === 'bigint'
        ? account.opening_balance_cents
        : BigInt(account.opening_balance_cents ?? 0);

    const incomeAmount =
      typeof income._sum.amount_cents === 'bigint'
        ? income._sum.amount_cents
        : BigInt(income._sum.amount_cents ?? 0);

    const expenseAmount =
      typeof expense._sum.amount_cents === 'bigint'
        ? expense._sum.amount_cents
        : BigInt(expense._sum.amount_cents ?? 0);

    const newBalance = opening + incomeAmount - expenseAmount;

    await tx.account.update({
      where: { id: accountId },
      data: { current_balance_cents: newBalance },
    });

    return newBalance;
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      action: string;
      entityId: string;
      recoveryId: string;
      findingId: string;
      actorId: string;
      beforeValueCents: bigint;
      afterValueCents: bigint;
      sourceFingerprint: string;
      ledgerStatus: RecoveryLedgerStatus;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        user_id: params.userId,
        action: params.action,
        module: 'audit',
        entity_type: 'Transaction',
        entity_id: params.entityId,
        metadata: AuditLogService.sanitize({
          recoveryId: params.recoveryId,
          findingId: params.findingId,
          actorId: params.actorId,
          beforeValueCents: params.beforeValueCents.toString(),
          afterValueCents: params.afterValueCents.toString(),
          sourceFingerprint: params.sourceFingerprint,
          ledgerStatus: params.ledgerStatus,
        }) as Prisma.InputJsonValue,
      },
    });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
