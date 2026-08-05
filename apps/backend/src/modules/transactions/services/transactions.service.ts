import { Injectable, Logger } from '@nestjs/common';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { TransactionEntity } from '../entities/transaction.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { AuditAction, AuditModule } from '../../audit-logs/constants/audit.constants';
import { TransactionValidationService } from './validation/transaction-validation.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly repo: PrismaTransactionsRepository,
    private readonly audit: AuditLogService,
    private readonly validator: TransactionValidationService,
  ) {}

  async create(userId: string, input: Partial<TransactionEntity>): Promise<TransactionEntity> {
    // Basic checks
    if (!input.account_id) throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Account is required');
    if (!input.category_id) throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Category is required');
    if (!input.amount_cents || input.amount_cents <= BigInt(0)) throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Amount must be greater than zero');

    // Run business validation
    await this.validator.validateForCreate(userId, input as TransactionEntity);

    const prepared: Partial<TransactionEntity> = {
      user_id: userId,
      account_id: input.account_id,
      category_id: input.category_id,
      transaction_type: input.transaction_type,
      amount_cents: input.amount_cents,
      transaction_date: input.transaction_date,
      note: input.note ?? null,
    };

    const created = await this.repo.create(prepared);
    void this.audit.record({ userId, action: AuditAction.TRANSACTION_CREATED, module: AuditModule.TRANSACTION, entityType: 'Transaction', entityId: created.id });
    this.logger.log(`Transaction Created user=${userId} id=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<TransactionEntity> {
    const t = await this.repo.findById(id);
    if (!t) throw ErrorService.create(ErrorCode.NOT_FOUND, 'Transaction not found');
    if (t.user_id !== userId) throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    return t;
  }

  async listAll(userId: string): Promise<TransactionEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async update(userId: string, id: string, updates: Partial<TransactionEntity>): Promise<TransactionEntity> {
    const t = await this.getById(userId, id);
    // Validate updates
    if (updates.amount_cents !== undefined && updates.amount_cents <= BigInt(0)) throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Amount must be greater than zero');

    // run validation for updates (reuse same validator)
    await this.validator.validateForUpdate(userId, { ...t, ...updates } as TransactionEntity);

    const data: Partial<TransactionEntity> = { ...updates };
    const updated = await this.repo.update(id, data);
    void this.audit.record({ userId, action: AuditAction.TRANSACTION_UPDATED, module: AuditModule.TRANSACTION, entityType: 'Transaction', entityId: updated.id });
    this.logger.log(`Transaction Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const t = await this.getById(userId, id);
    await this.repo.softDelete(id);
    void this.audit.record({ userId, action: AuditAction.TRANSACTION_DELETED, module: AuditModule.TRANSACTION, entityType: 'Transaction', entityId: id });
    this.logger.log(`Transaction Deleted user=${userId} id=${id}`);
  }
}
