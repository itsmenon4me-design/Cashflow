import { Injectable, Logger } from '@nestjs/common';
import { PrismaSavingGoalsRepository } from '../repositories/prisma-saving-goals.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SavingGoalEntity } from '../entities/saving-goal.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { CreateSavingGoalDto } from '../dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from '../dto/update-saving-goal.dto';
import { FIXED_CURRENCY } from '../../../common/currencies';

@Injectable()
export class SavingGoalsService {
  private readonly logger = new Logger(SavingGoalsService.name);

  constructor(
    private readonly repo: PrismaSavingGoalsRepository,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private async validateReferences(
    userId: string,
    accountId?: string | null,
    categoryId?: string | null,
  ) {
    if (accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });
      if (!account || account.deleted_at || account.user_id !== userId) {
        throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid account');
      }
      if (!account.is_active) {
        throw ErrorService.create(
          ErrorCode.INVALID_INPUT,
          'Account is not active',
        );
      }
    }
    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category || category.deleted_at) {
        throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid category');
      }
      if (!category.is_system && category.user_id !== userId) {
        throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid category');
      }
    }
  }

  private validateDates(startDate: Date, targetDate: Date) {
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(targetDate.getTime())
    ) {
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid date');
    }
    if (targetDate.getTime() <= startDate.getTime()) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Target date must be after start date',
      );
    }
  }

  async create(
    userId: string,
    input: CreateSavingGoalDto,
  ): Promise<SavingGoalEntity> {
    await this.validateReferences(userId, input.account_id, input.category_id);

    const startDate = new Date(input.start_date);
    const targetDate = new Date(input.target_date);
    this.validateDates(startDate, targetDate);

    const created = await this.repo.create({
      user_id: userId,
      account_id: input.account_id ?? null,
      category_id: input.category_id ?? null,
      currency: FIXED_CURRENCY,
      name: input.name,
      description: input.description ?? null,
      target_amount_cents: BigInt(input.target_amount_cents),
      current_amount_cents: BigInt(input.current_amount_cents ?? 0),
      start_date: startDate,
      target_date: targetDate,
      status: input.status ?? 'ACTIVE',
    } as any);

    void this.audit.record({
      userId,
      action: AuditAction.SAVING_GOAL_CREATED,
      module: AuditModule.SAVING_GOAL,
      entityType: 'SavingGoal',
      entityId: created.id,
    });
    this.logger.log(`SavingGoal Created user=${userId} id=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<SavingGoalEntity> {
    const goal = await this.repo.findById(id);
    if (!goal) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Saving goal not found');
    }
    if (goal.user_id !== userId) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    return goal;
  }

  async listAll(userId: string): Promise<SavingGoalEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async update(
    userId: string,
    id: string,
    updates: UpdateSavingGoalDto,
  ): Promise<SavingGoalEntity> {
    const current = await this.getById(userId, id);

    const nextAccountId =
      updates.account_id !== undefined
        ? updates.account_id
        : current.account_id;
    const nextCategoryId =
      updates.category_id !== undefined
        ? updates.category_id
        : current.category_id;
    await this.validateReferences(userId, nextAccountId, nextCategoryId);

    const startDate =
      updates.start_date !== undefined
        ? new Date(updates.start_date)
        : current.start_date;
    const targetDate =
      updates.target_date !== undefined
        ? new Date(updates.target_date)
        : current.target_date;
    this.validateDates(startDate, targetDate);

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      const value = (updates as unknown as Record<string, unknown>)[key];
      if (value !== undefined) data[key] = value;
    }
    if (updates.target_amount_cents !== undefined) {
      data.target_amount_cents = BigInt(updates.target_amount_cents);
    }
    if (updates.current_amount_cents !== undefined) {
      data.current_amount_cents = BigInt(updates.current_amount_cents);
    }
    if (updates.start_date !== undefined) {
      data.start_date = startDate;
    }
    if (updates.target_date !== undefined) {
      data.target_date = targetDate;
    }

    const updated = await this.repo.update(id, data as any);

    void this.audit.record({
      userId,
      action: AuditAction.SAVING_GOAL_UPDATED,
      module: AuditModule.SAVING_GOAL,
      entityType: 'SavingGoal',
      entityId: updated.id,
    });
    this.logger.log(`SavingGoal Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.repo.softDelete(id);
    void this.audit.record({
      userId,
      action: AuditAction.SAVING_GOAL_DELETED,
      module: AuditModule.SAVING_GOAL,
      entityType: 'SavingGoal',
      entityId: id,
    });
    this.logger.log(`SavingGoal Deleted user=${userId} id=${id}`);
  }

  async overview(userId: string) {
    const goals = await this.repo.findAllByUser(userId);

    const active = goals.filter((g) => g.status === 'ACTIVE');

    // Resolve currencies for linked accounts (for the remaining active goals)
    const accountIds = active
      .map((g) => g.account_id)
      .filter((id): id is string => typeof id === 'string');

    const accounts =
      accountIds.length > 0
        ? await this.prisma.account.findMany({
            where: { id: { in: accountIds } },
            select: { id: true, currency: true },
          })
        : [];
    const currencyByAccountId = new Map(
      accounts.map((a) => [a.id, a.currency]),
    );

    const currencyMap = new Map<string, { target: bigint; current: bigint }>();

    for (const g of active) {
      const curr = g.currency ?? (g.account_id ? (currencyByAccountId.get(g.account_id) ?? 'IDR') : 'IDR');
      const entry = currencyMap.get(curr) ?? { target: 0n, current: 0n };
      entry.target += g.target_amount_cents;
      entry.current += g.current_amount_cents;
      currencyMap.set(curr, entry);
    }

    if (currencyMap.size === 0) {
      // Zeroed bucket in the fixed ledger currency preserves legacy shape.
      currencyMap.set(FIXED_CURRENCY, { target: 0n, current: 0n });
    }

    const primaryCurrency = Array.from(currencyMap.keys())[0] ?? 'IDR';
    const primary = currencyMap.get(primaryCurrency)!;
    const primaryPercentage =
      primary.target === 0n
        ? 0
        : Number(((primary.current * 10000n) / primary.target).toString()) /
          100;

    const byCurrency = Array.from(currencyMap.entries()).map(([curr, data]) => {
      const pct =
        data.target === 0n
          ? 0
          : Number(((data.current * 10000n) / data.target).toString()) / 100;
      return {
        currency: curr,
        targetAmount: data.target.toString(),
        currentAmount: data.current.toString(),
        percentageUsed: pct,
      };
    });

    return {
      total: goals.length,
      active: active.length,
      completed: goals.filter((g) => g.status === 'COMPLETED').length,
      currency: primaryCurrency,
      targetAmount: primary.target.toString(),
      currentAmount: primary.current.toString(),
      percentageUsed: primaryPercentage,
      by_currency: byCurrency,
    };
}
}

