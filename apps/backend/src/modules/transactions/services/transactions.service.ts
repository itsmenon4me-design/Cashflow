import { Injectable, Logger } from '@nestjs/common';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { TransactionEntity } from '../entities/transaction.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../notifications/constants/notification.constants';
import { BalanceService } from '../../accounts/services/balance.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';
import { formatMoneyFromMinorUnits } from '../../../common/utils/money.utils';
import { normalizeAmountCents } from '../utils/amount.utils';

export interface TransactionTraceContext {
  correlationId?: string;
  requestId?: string;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly repo: PrismaTransactionsRepository,
    private readonly audit: AuditLogService,
    private readonly validator: TransactionValidationService,
    private readonly notifications: NotificationsService,
    private readonly balance: BalanceService,
    private readonly financeBot: FinanceBotService,
  ) {}

  private buildAuditMetadata(
    userId: string,
    entityId: string,
    input: Partial<TransactionEntity>,
    trace?: TransactionTraceContext,
    status = 'success',
    operation = 'CREATE',
    anomalyCode?: string,
  ): Record<string, unknown> {
    return {
      userId,
      entityId,
      correlationId: trace?.correlationId ?? null,
      requestId: trace?.requestId ?? null,
      accountId: input.account_id ?? null,
      categoryId: input.category_id ?? null,
      transactionType: input.transaction_type ?? null,
      amountCents: input.amount_cents?.toString?.() ?? null,
      operation,
      validationResult: status,
      result: status === 'success' ? 'ACCEPTED' : 'REJECTED',
      anomalyCode: anomalyCode ?? null,
      timestamp: new Date().toISOString(),
    };
  }

  private async detectAmountScaleAnomaly(
    userId: string,
    accountId: string,
    amountCents: bigint,
  ): Promise<string | null> {
    if (
      amountCents <= 0n ||
      typeof this.repo.findByUserWithFilter !== 'function'
    ) {
      return null;
    }

    const recent = await this.repo.findByUserWithFilter(
      userId,
      { accountId },
      { page: 1, limit: 50 },
    );
    const knownAmounts = (recent?.items ?? [])
      .map((item) => item.amount_cents)
      .filter(
        (value): value is bigint => typeof value === 'bigint' && value > 0n,
      );

    const suspicious = knownAmounts.some(
      (value) =>
        value === amountCents * 100n ||
        value === amountCents / 100n ||
        amountCents === value * 100n ||
        amountCents === value / 100n,
    );

    if (!suspicious) {
      return null;
    }

    return 'AMOUNT_SCALE_ANOMALY';
  }

  async create(
    userId: string,
    input: Partial<TransactionEntity>,
    trace?: TransactionTraceContext,
  ): Promise<TransactionEntity> {
    if (!input.account_id)
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Account is required');
    if (!input.category_id)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Category is required',
      );

    const amountCents = normalizeAmountCents(input.amount_cents);
    if (amountCents <= 0n)
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Amount must be greater than zero',
      );

    const normalizedInput = { ...input, amount_cents: amountCents };

    // Idempotent replay for offline sync: if the client supplied an
    // idempotency key (reference_number) and a transaction already exists for
    // this user, return the existing one instead of inserting a duplicate.
    if (
      input.reference_number &&
      typeof this.repo.findByReferenceNumber === 'function'
    ) {
      const existing = await this.repo.findByReferenceNumber(
        userId,
        input.reference_number,
      );
      if (existing) {
        this.logger.log(
          `Transaction replay skipped user=${userId} ref=${input.reference_number}`,
        );
        return existing;
      }
    }

    // Run business validation
    await this.validator.validateForCreate(userId, normalizedInput);

    const amountAnomaly = await this.detectAmountScaleAnomaly(
      userId,
      input.account_id,
      amountCents,
    );

    const prepared: Partial<TransactionEntity> = {
      user_id: userId,
      account_id: input.account_id,
      category_id: input.category_id,
      transaction_type: input.transaction_type,
      amount_cents: amountCents,
      transaction_date: input.transaction_date,
      note: input.note ?? null,
      reference_number: input.reference_number ?? null,
    };

    const created = await this.repo.create(prepared);
    await this.balance.recalculateAccount(created.account_id);
    void this.audit.record({
      userId,
      action: AuditAction.TRANSACTION_CREATED,
      module: AuditModule.TRANSACTION,
      entityType: 'Transaction',
      entityId: created.id,
      metadata: this.buildAuditMetadata(
        userId,
        created.id,
        prepared,
        trace,
        'success',
        'CREATE',
        amountAnomaly ?? undefined,
      ),
    });
    void this.notifyTransactionCreated(userId, created);
    this.logger.log(
      `Transaction Created user=${userId} id=${created.id} correlation=${trace?.correlationId ?? 'n/a'} request=${trace?.requestId ?? 'n/a'}`,
    );
    if (amountAnomaly) {
      this.logger.warn(
        `Amount scale anomaly detected user=${userId} account=${input.account_id} amount=${amountCents.toString()} code=${amountAnomaly}`,
      );
    }
    return created;
  }

  private async notifyTransactionCreated(
    userId: string,
    created: TransactionEntity,
  ): Promise<void> {
    try {
      const typeLabel =
        created.transaction_type === 'INCOME' ? 'pemasukan' : 'pengeluaran';
      const currency = created.account_id
        ? await this.repo.getAccountCurrency(created.account_id)
        : 'IDR';
      const amount = formatMoneyFromMinorUnits(
        created.amount_cents ?? 0n,
        currency,
      );
      await this.notifications.create(
        userId,
        NotificationType.TRANSACTION,
        `Transaksi ${typeLabel} baru`,
        `Transaksi ${typeLabel} tercatat sebesar ${amount}.`,
        {
          transactionId: created.id,
          transactionType: created.transaction_type,
          amountCents: created.amount_cents?.toString(),
          currency,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create transaction notification for user=${userId} error=${(error as Error).message}`,
      );
    }

    // Fire Finance Bot evaluation asynchronously; failures must not affect transaction flow
    const evaluation = this.financeBot?.evaluateOnTransaction?.(
      userId,
      created,
    );
    if (
      evaluation !== undefined &&
      typeof (evaluation as Promise<unknown>).catch === 'function'
    ) {
      (evaluation as Promise<unknown>).catch((err) => {
        this.logger.warn(
          `FinanceBot evaluation failed for user=${userId} ${(err as Error).message}`,
        );
      });
    }
  }

  async getById(userId: string, id: string): Promise<TransactionEntity> {
    const t = await this.repo.findById(id);
    if (!t)
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Transaction not found');
    if (t.user_id !== userId)
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    return t;
  }

  async listAll(
    userId: string,
    filter?: TransactionFilterDto,
    pagination?: PaginationDto,
  ): Promise<{
    data: TransactionEntity[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    // normalize pagination
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 20;

    const { items, total } = await this.repo.findByUserWithFilter(
      userId,
      filter ?? {},
      { page, limit },
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const out = {
      data: items,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
    return out;
  }

  async update(
    userId: string,
    id: string,
    updates: Partial<TransactionEntity>,
    trace?: TransactionTraceContext,
  ): Promise<TransactionEntity> {
    const t = await this.getById(userId, id);
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.amount_cents !== undefined) {
      normalizedUpdates.amount_cents = normalizeAmountCents(
        normalizedUpdates.amount_cents,
      );
    }

    if (
      normalizedUpdates.amount_cents !== undefined &&
      normalizedUpdates.amount_cents <= 0n
    )
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Amount must be greater than zero',
      );

    // Merge the existing entity with only the explicitly provided updates.
    // DTO instances carry own undefined properties (account_id/category_id/...),
    // so a raw spread would wipe out the existing values on the entity.
    const merged: Record<string, unknown> = {};
    for (const key of Object.keys(t)) {
      merged[key] = (t as unknown as Record<string, unknown>)[key];
    }
    for (const key of Object.keys(normalizedUpdates)) {
      const value = (normalizedUpdates as unknown as Record<string, unknown>)[
        key
      ];
      if (value !== undefined) merged[key] = value;
    }

    // run validation for updates (reuse same validator)
    await this.validator.validateForUpdate(userId, merged);

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(normalizedUpdates)) {
      const value = (normalizedUpdates as unknown as Record<string, unknown>)[
        key
      ];
      if (value !== undefined) data[key] = value;
    }
    const updated = await this.repo.update(id, data);
    await this.balance.recalculateAccount(updated.account_id);
    if (
      normalizedUpdates.account_id !== undefined &&
      normalizedUpdates.account_id !== t.account_id
    ) {
      await this.balance.recalculateAccount(t.account_id);
    }
    void this.audit.record({
      userId,
      action: AuditAction.TRANSACTION_UPDATED,
      module: AuditModule.TRANSACTION,
      entityType: 'Transaction',
      entityId: updated.id,
      metadata: this.buildAuditMetadata(
        userId,
        updated.id,
        { ...t, ...normalizedUpdates },
        trace,
        'success',
        'UPDATE',
      ),
    });
    this.logger.log(
      `Transaction Updated user=${userId} id=${updated.id} correlation=${trace?.correlationId ?? 'n/a'} request=${trace?.requestId ?? 'n/a'}`,
    );
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const t = await this.getById(userId, id);
    await this.repo.softDelete(id);
    await this.balance.recalculateAccount(t.account_id);
    void this.audit.record({
      userId,
      action: AuditAction.TRANSACTION_DELETED,
      module: AuditModule.TRANSACTION,
      entityType: 'Transaction',
      entityId: id,
    });
    this.logger.log(`Transaction Deleted user=${userId} id=${id}`);
  }

  // Search transactions by keyword across supported fields
  async search(
    userId: string,
    q: string,
    pagination?: PaginationDto,
  ): Promise<{
    data: TransactionEntity[];
    pagination: {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 20;

    const { items, total } = await this.repo.searchByUser(userId, q, {
      page,
      limit,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: items,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }
}
