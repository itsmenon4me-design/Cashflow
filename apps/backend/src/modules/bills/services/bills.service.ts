import { Injectable, Logger } from '@nestjs/common';
import { PrismaBillsRepository } from '../repositories/prisma-bills.repository';
import { PrismaService } from '../../../database/prisma.service';
import { BillEntity } from '../entities/bill.entity';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { CreateBillDto } from '../dto/create-bill.dto';
import { UpdateBillDto } from '../dto/update-bill.dto';
import { FIXED_CURRENCY } from '../../../common/currencies';

const DEFAULT_UPCOMING_WINDOW_DAYS = 90;

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private readonly repo: PrismaBillsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validates that referenced account/category belong to the authenticated user
   * (or are a system category). Rejects cross-user references.
   */
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

  private async assertBillCurrencyMatchesAccount(
    currency: string | undefined,
    accountId: string | undefined | null,
  ) {
    if (!currency || !accountId) return;
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (account && account.currency !== currency) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'Bill currency must match its linked account currency',
      );
    }
  }

  async list(userId: string): Promise<BillEntity[]> {
    return this.repo.findAllByUser(userId);
  }

  async upcoming(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<BillEntity[]> {
    const now = new Date();
    const startRaw = from ? new Date(from) : new Date(NaN);
    const endRaw = to ? new Date(to) : new Date(NaN);
    const start =
      startRaw && !Number.isNaN(startRaw.getTime()) ? startRaw : now;
    const end =
      endRaw && !Number.isNaN(endRaw.getTime())
        ? endRaw
        : new Date(
            Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate() + DEFAULT_UPCOMING_WINDOW_DAYS,
            ),
          );
    if (end.getTime() < start.getTime()) {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        'End date must be after start date',
      );
    }
    return this.repo.findUpcomingByUser(userId, start, end);
  }

  async getById(userId: string, id: string): Promise<BillEntity> {
    const bill = await this.repo.findByIdOwned(id, userId);
    if (!bill) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Bill not found');
    }
    return bill;
  }

  async create(
    userId: string,
    dto: CreateBillDto,
  ): Promise<BillEntity> {
    const billCurrency = dto.currency ?? FIXED_CURRENCY;
    await this.validateReferences(
      userId,
      dto.account_id,
      dto.category_id,
    );
    await this.assertBillCurrencyMatchesAccount(billCurrency, dto.account_id);

    const created = await this.repo.create({
      user_id: userId,
      payee: dto.payee,
      amount_cents: BigInt(dto.amount_cents),
      currency: billCurrency,
      account_id: dto.account_id,
      category_id: dto.category_id,
      due_date: new Date(dto.due_date),
      due_date_timezone: dto.due_date_timezone,
      recurrence_type: dto.recurrence_type,
      recurrence_interval: dto.recurrence_interval ?? null,
      recurrence_ends_at: dto.recurrence_ends_at
        ? new Date(dto.recurrence_ends_at)
        : null,
      is_template: dto.is_template ?? false,
      reminder_enabled: dto.reminder_enabled ?? true,
      reminder_days_before: dto.reminder_days_before ?? 1,
      reminder_time: dto.reminder_time ?? null,
    });

    this.logger.log(`Bill Created user=${userId} id=${created.id}`);
    return created;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBillDto,
  ): Promise<BillEntity> {
    const current = await this.getById(userId, id);

    const nextAccountId =
      dto.account_id !== undefined ? dto.account_id : current.account_id;
    const nextCategoryId =
      dto.category_id !== undefined ? dto.category_id : current.category_id;
    await this.validateReferences(
      userId,
      nextAccountId,
      nextCategoryId,
    );

    const nextCurrency = dto.currency ?? current.currency;
    await this.assertBillCurrencyMatchesAccount(nextCurrency, nextAccountId);

    const updates: Partial<BillEntity> = {};
    if (dto.payee !== undefined) updates.payee = dto.payee;
    if (dto.amount_cents !== undefined)
      updates.amount_cents = BigInt(dto.amount_cents);
    if (dto.currency !== undefined) updates.currency = dto.currency;
    if (dto.account_id !== undefined) updates.account_id = dto.account_id;
    if (dto.category_id !== undefined) updates.category_id = dto.category_id;
    if (dto.due_date !== undefined) updates.due_date = new Date(dto.due_date);
    if (dto.due_date_timezone !== undefined)
      updates.due_date_timezone = dto.due_date_timezone;
    if (dto.recurrence_type !== undefined)
      updates.recurrence_type = dto.recurrence_type;
    if (dto.recurrence_interval !== undefined)
      updates.recurrence_interval = dto.recurrence_interval;
    if (dto.recurrence_ends_at !== undefined)
      updates.recurrence_ends_at = dto.recurrence_ends_at
        ? new Date(dto.recurrence_ends_at)
        : null;
    if (dto.is_template !== undefined) updates.is_template = dto.is_template;
    if (dto.reminder_enabled !== undefined)
      updates.reminder_enabled = dto.reminder_enabled;
    if (dto.reminder_days_before !== undefined)
      updates.reminder_days_before = dto.reminder_days_before;
    if (dto.reminder_time !== undefined)
      updates.reminder_time = dto.reminder_time;
    if (dto.is_paid !== undefined) updates.is_paid = dto.is_paid;

    const updated = await this.repo.updateOwned(id, userId, updates);
    if (!updated) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Bill not found');
    }

    this.logger.log(`Bill Updated user=${userId} id=${updated.id}`);
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    const deleted = await this.repo.softDeleteOwned(id, userId);
    if (!deleted) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Bill not found');
    }
    this.logger.log(`Bill Deleted user=${userId} id=${id}`);
  }
}
