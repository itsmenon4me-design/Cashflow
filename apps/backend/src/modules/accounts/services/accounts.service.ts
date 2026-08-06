import { Injectable, Logger } from '@nestjs/common';
import { PrismaAccountsRepository } from '../repositories/prisma-accounts.repository';
import { AccountEntity } from '../entities/account.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { BalanceService } from './balance.service';
import type { CreateAccountDto } from '../dto/create-account.dto';
import type { UpdateAccountDto } from '../dto/update-account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly repo: PrismaAccountsRepository,
    private readonly audit: AuditLogService,
    private readonly balance: BalanceService,
  ) {}

  async create(
    userId: string,
    input: Partial<AccountEntity> | CreateAccountDto,
  ): Promise<AccountEntity> {
    // Validation
    if (!input.name)
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Name is required');
    if (
      input.opening_balance_cents !== undefined &&
      input.opening_balance_cents < 0
    )
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Opening balance cannot be negative',
      );

    // Unique name per user
    const existing = await this.repo.findByUserAndName(userId, input.name);
    if (existing)
      throw ErrorService.create(
        ErrorCode.CONFLICT,
        'Account name already exists',
      );

    const acc: Partial<AccountEntity> = {
      user_id: userId,
      name: input.name,
      account_type: input.account_type ?? 'OTHER',
      currency: input.currency ?? 'IDR',
      opening_balance_cents:
        input.opening_balance_cents !== undefined
          ? BigInt(input.opening_balance_cents)
          : BigInt(0),
      current_balance_cents:
        input.opening_balance_cents !== undefined
          ? BigInt(input.opening_balance_cents)
          : BigInt(0),
      color: input.color ?? null,
      icon: input.icon ?? null,
      description: input.description ?? null,
      is_default: input.is_default ?? false,
    };

    // If set as default, unset existing default
    if (acc.is_default) {
      await this.repo.unsetDefaultForUser(userId);
    }

    const created = await this.repo.create(acc);

    // Audit log
    void this.audit.record({
      userId,
      action: AuditAction.ACCOUNT_CREATED,
      module: AuditModule.ACCOUNT,
      entityType: 'Account',
      entityId: created.id,
    });

    this.logger.log(`Account Created user=${userId} account=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<AccountEntity> {
    const acc = await this.repo.findById(id);
    if (!acc)
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Account not found');
    if (acc.user_id !== userId)
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    return acc;
  }

  async listAll(userId: string): Promise<AccountEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async update(
    userId: string,
    id: string,
    updates: Partial<AccountEntity> | UpdateAccountDto,
  ): Promise<AccountEntity> {
    const acc = await this.getById(userId, id);
    if (updates.name && updates.name !== acc.name) {
      const other = await this.repo.findByUserAndName(userId, updates.name);
      if (other)
        throw ErrorService.create(
          ErrorCode.CONFLICT,
          'Account name already exists',
        );
    }

    if (
      updates.opening_balance_cents !== undefined &&
      updates.opening_balance_cents < 0
    ) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Opening balance cannot be negative',
      );
    }

    const incoming = updates as Partial<AccountEntity> & {
      opening_balance_cents?: number | bigint;
      current_balance_cents?: number | bigint;
    };

    const data: Partial<AccountEntity> = { ...incoming };

    if (incoming.opening_balance_cents !== undefined) {
      data.opening_balance_cents =
        typeof incoming.opening_balance_cents === 'bigint'
          ? incoming.opening_balance_cents
          : BigInt(incoming.opening_balance_cents);
    }

    if (incoming.current_balance_cents !== undefined) {
      data.current_balance_cents =
        typeof incoming.current_balance_cents === 'bigint'
          ? incoming.current_balance_cents
          : BigInt(incoming.current_balance_cents);
    }

    const updated = await this.repo.update(id, data);

    void this.audit.record({
      userId,
      action: AuditAction.ACCOUNT_UPDATED,
      module: AuditModule.ACCOUNT,
      entityType: 'Account',
      entityId: updated.id,
    });

    this.logger.log(`Account Updated user=${userId} account=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.repo.softDelete(id);
    void this.audit.record({
      userId,
      action: AuditAction.ACCOUNT_DELETED,
      module: AuditModule.ACCOUNT,
      entityType: 'Account',
      entityId: id,
    });
    this.logger.log(`Account Deleted user=${userId} account=${id}`);
  }

  async setDefault(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.repo.unsetDefaultForUser(userId);
    await this.repo.update(id, { is_default: true });
    void this.audit.record({
      userId,
      action: AuditAction.DEFAULT_ACCOUNT_CHANGED,
      module: AuditModule.ACCOUNT,
      entityType: 'Account',
      entityId: id,
    });
    this.logger.log(`Default Account Changed user=${userId} account=${id}`);
  }

  async recalculateAll(): Promise<void> {
    const accounts = await this.repo.findAll();
    for (const a of accounts) {
      try {
        await this.balance.recalculateAccount(a.id);
      } catch (err) {
        this.logger.warn(`Failed to recalc account ${a.id}: ${String(err)}`);
      }
    }
    void this.audit.record({
      userId: null,
      action: AuditAction.TRANSACTION_UPDATED,
      module: AuditModule.ACCOUNT,
      entityType: 'AccountRecalculate',
      entityId: null,
      metadata: { count: accounts.length },
    });
  }
}
