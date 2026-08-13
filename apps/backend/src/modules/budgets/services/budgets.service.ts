import { Injectable, Logger } from '@nestjs/common';
import { PrismaBudgetsRepository } from '../repositories/prisma-budgets.repository';
import { PrismaService } from '../../../database/prisma.service';
import { BudgetEntity } from '../entities/budget.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import {
  AuditAction,
  AuditModule,
} from '../../audit-logs/constants/audit.constants';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { UpdateBudgetDto } from '../dto/update-budget.dto';

interface CategoryRecord {
  id: string;
  user_id: string;
  type: string;
  is_active: boolean;
  is_system: boolean;
  deleted_at: Date | null;
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly repo: PrismaBudgetsRepository,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private async findValidCategory(
    userId: string,
    categoryId: string,
  ): Promise<CategoryRecord> {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!cat || cat.deleted_at) {
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid category');
    }
    if (!cat.is_system && cat.user_id !== userId) {
      throw ErrorService.create(ErrorCode.INVALID_INPUT, 'Invalid category');
    }
    if (!cat.is_active) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Category is not active',
      );
    }
    if (cat.type !== 'EXPENSE') {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Budget can only be set for expense categories',
      );
    }
    return cat;
  }

  async create(userId: string, input: CreateBudgetDto): Promise<BudgetEntity> {
    await this.findValidCategory(userId, input.category_id);

    const existing = await this.repo.findByUserAndCategoryAndPeriod(
      userId,
      input.category_id,
      input.month,
      input.year,
    );
    if (existing) {
      throw ErrorService.create(
        ErrorCode.CONFLICT,
        'Budget already exists for this category and period',
      );
    }

    const created = await this.repo.create({
      user_id: userId,
      category_id: input.category_id,
      budget_amount_cents: BigInt(input.budget_amount_cents),
      month: input.month,
      year: input.year,
    });

    void this.audit.record({
      userId,
      action: AuditAction.BUDGET_CREATED,
      module: AuditModule.BUDGET,
      entityType: 'Budget',
      entityId: created.id,
    });
    this.logger.log(`Budget Created user=${userId} id=${created.id}`);
    return created;
  }

  async getById(userId: string, id: string): Promise<BudgetEntity> {
    const b = await this.repo.findById(id);
    if (!b) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Budget not found');
    }
    if (b.user_id !== userId) {
      throw ErrorService.create(ErrorCode.FORBIDDEN, 'Access denied');
    }
    return b;
  }

  async listAll(userId: string): Promise<BudgetEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async update(
    userId: string,
    id: string,
    updates: UpdateBudgetDto,
  ): Promise<BudgetEntity> {
    const current = await this.getById(userId, id);

    if (updates.category_id !== undefined) {
      await this.findValidCategory(userId, updates.category_id);
    }

    const nextCategoryId = updates.category_id ?? current.category_id;
    const nextMonth = updates.month ?? current.month;
    const nextYear = updates.year ?? current.year;

    if (
      (updates.category_id !== undefined ||
        updates.month !== undefined ||
        updates.year !== undefined) &&
      (nextCategoryId !== current.category_id ||
        nextMonth !== current.month ||
        nextYear !== current.year)
    ) {
      const other = await this.repo.findByUserAndCategoryAndPeriod(
        userId,
        nextCategoryId,
        nextMonth,
        nextYear,
      );
      if (other && other.id !== id) {
        throw ErrorService.create(
          ErrorCode.CONFLICT,
          'Budget already exists for this category and period',
        );
      }
    }

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      const value = (updates as unknown as Record<string, unknown>)[key];
      if (value !== undefined) data[key] = value;
    }
    if (updates.budget_amount_cents !== undefined) {
      data.budget_amount_cents = BigInt(updates.budget_amount_cents);
    }

    const updated = await this.repo.update(id, data);

    void this.audit.record({
      userId,
      action: AuditAction.BUDGET_UPDATED,
      module: AuditModule.BUDGET,
      entityType: 'Budget',
      entityId: updated.id,
    });
    this.logger.log(`Budget Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.repo.softDelete(id);
    void this.audit.record({
      userId,
      action: AuditAction.BUDGET_DELETED,
      module: AuditModule.BUDGET,
      entityType: 'Budget',
      entityId: id,
    });
    this.logger.log(`Budget Deleted user=${userId} id=${id}`);
  }
}
