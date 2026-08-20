import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IBillsRepository } from './bills.repository.interface';
import { BillEntity } from '../entities/bill.entity';
import type { Prisma, BillRecurrence } from '../../../generated/prisma/client';

type BillRecord = {
  id: string;
  user_id: string;
  payee: string;
  amount_cents: bigint;
  currency: string;
  account_id: string;
  category_id: string;
  due_date: Date;
  due_date_timezone: string;
  is_paid: boolean;
  paid_at: Date | null;
  transaction_id: string | null;
  status: string;
  recurrence_type: string;
  recurrence_interval: number | null;
  recurrence_ends_at: Date | null;
  series_id: string | null;
  is_template: boolean;
  reminder_enabled: boolean;
  reminder_days_before: number;
  reminder_time: string | null;
  reminder_config: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type BillCreateInput = {
  user_id: string;
  payee: string;
  amount_cents: bigint;
  currency: string;
  account_id: string;
  category_id: string;
  due_date: Date;
  due_date_timezone: string;
  is_paid?: boolean;
  paid_at?: Date | null;
  transaction_id?: string | null;
  status?: string;
  recurrence_type?: string;
  recurrence_interval?: number | null;
  recurrence_ends_at?: Date | null;
  series_id?: string | null;
  is_template?: boolean;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
  reminder_time?: string | null;
  reminder_config?: unknown;
};

type BillUpdateInput = {
  payee?: string;
  amount_cents?: bigint;
  currency?: string;
  account_id?: string;
  category_id?: string;
  due_date?: Date;
  due_date_timezone?: string;
  is_paid?: boolean;
  paid_at?: Date | null;
  transaction_id?: string | null;
  status?: string;
  recurrence_type?: string;
  recurrence_interval?: number | null;
  recurrence_ends_at?: Date | null;
  series_id?: string | null;
  is_template?: boolean;
  reminder_enabled?: boolean;
  reminder_days_before?: number;
  reminder_time?: string | null;
  reminder_config?: unknown;
};

@Injectable()
export class PrismaBillsRepository implements IBillsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: BillRecord): BillEntity {
    const bill = new BillEntity();

    bill.id = rec.id;
    bill.user_id = rec.user_id;
    bill.payee = rec.payee;
    bill.amount_cents = rec.amount_cents;
    bill.currency = rec.currency;
    bill.account_id = rec.account_id;
    bill.category_id = rec.category_id;
    bill.due_date = rec.due_date;
    bill.due_date_timezone = rec.due_date_timezone;
    bill.is_paid = rec.is_paid;
    bill.paid_at = rec.paid_at;
    bill.transaction_id = rec.transaction_id;
    bill.status = rec.status;
    bill.recurrence_type = rec.recurrence_type;
    bill.recurrence_interval = rec.recurrence_interval;
    bill.recurrence_ends_at = rec.recurrence_ends_at;
    bill.series_id = rec.series_id;
    bill.is_template = rec.is_template;
    bill.reminder_enabled = rec.reminder_enabled;
    bill.reminder_days_before = rec.reminder_days_before;
    bill.reminder_time = rec.reminder_time;
    bill.reminder_config = rec.reminder_config;
    bill.created_at = rec.created_at;
    bill.updated_at = rec.updated_at;
    bill.deleted_at = rec.deleted_at;

    return bill;
  }

  async create(input: BillCreateInput) {
    const data = {
      user_id: input.user_id,
      payee: input.payee,
      amount_cents: input.amount_cents,
      currency: input.currency,
      account_id: input.account_id,
      category_id: input.category_id,
      due_date: input.due_date,
      due_date_timezone: input.due_date_timezone,
      is_paid: input.is_paid ?? false,
      paid_at: input.paid_at ?? null,
      transaction_id: input.transaction_id ?? null,
      status: input.status ?? 'OPEN',
      recurrence_type: input.recurrence_type ?? 'NONE',
      recurrence_interval: input.recurrence_interval ?? null,
      recurrence_ends_at: input.recurrence_ends_at ?? null,
      series_id: input.series_id ?? null,
      is_template: input.is_template ?? false,
      reminder_enabled: input.reminder_enabled ?? true,
      reminder_days_before: input.reminder_days_before ?? 1,
      reminder_time: input.reminder_time ?? null,
      reminder_config: input.reminder_config ?? {},
    } as Prisma.BillUncheckedCreateInput;

    const rec = await this.prisma.bill.create({
      data,
    });

    return this.map(rec as unknown as BillRecord);
  }

  async findByIdOwned(id: string, userId: string, currency?: string) {
    const where: any = { id, user_id: userId, deleted_at: null };
    if (currency) where.currency = currency;

    const rec = await this.prisma.bill.findFirst({ where });

    if (!rec) {
      return null;
    }

    return this.map(rec as unknown as BillRecord);
  }

  async findAllByUser(userId: string, currency?: string) {
    const where: any = {
      user_id: userId,
      deleted_at: null,
    };
    if (currency) where.currency = currency;

    const recs = await this.prisma.bill.findMany({
      where,
      orderBy: {
        due_date: 'asc',
      },
    });

    return (recs as unknown as BillRecord[]).map((rec) => this.map(rec));
  }

  async findUpcomingByUser(userId: string, from: Date, to: Date, currency?: string) {
    const where: any = {
      user_id: userId,
      deleted_at: null,
      due_date: {
        gte: from,
        lte: to,
      },
    };
    if (currency) where.currency = currency;

    const recs = await this.prisma.bill.findMany({
      where,
      orderBy: {
        due_date: 'asc',
      },
    });

    return (recs as unknown as BillRecord[]).map((rec) => this.map(rec));
  }

  private buildUpdateData(
    updates: BillUpdateInput,
  ): Prisma.BillUncheckedUpdateInput {
    const data: Prisma.BillUncheckedUpdateInput = {};

    if (updates.payee !== undefined) {
      data.payee = updates.payee;
    }

    if (updates.amount_cents !== undefined) {
      data.amount_cents = updates.amount_cents;
    }

    if (updates.currency !== undefined) {
      data.currency = updates.currency;
    }

    if (updates.account_id !== undefined) {
      data.account_id = updates.account_id;
    }

    if (updates.category_id !== undefined) {
      data.category_id = updates.category_id;
    }

    if (updates.due_date !== undefined) {
      data.due_date = updates.due_date;
    }

    if (updates.due_date_timezone !== undefined) {
      data.due_date_timezone = updates.due_date_timezone;
    }

    if (updates.is_paid !== undefined) {
      data.is_paid = updates.is_paid;
    }

    if (updates.paid_at !== undefined) {
      data.paid_at = updates.paid_at;
    }

    if (updates.transaction_id !== undefined) {
      data.transaction_id = updates.transaction_id;
    }

    if (updates.status !== undefined) {
      data.status = updates.status;
    }

    if (updates.recurrence_type !== undefined) {
      data.recurrence_type = updates.recurrence_type as BillRecurrence;
    }

    if (updates.recurrence_interval !== undefined) {
      data.recurrence_interval = updates.recurrence_interval;
    }

    if (updates.recurrence_ends_at !== undefined) {
      data.recurrence_ends_at = updates.recurrence_ends_at;
    }

    if (updates.series_id !== undefined) {
      data.series_id = updates.series_id;
    }

    if (updates.is_template !== undefined) {
      data.is_template = updates.is_template;
    }

    if (updates.reminder_enabled !== undefined) {
      data.reminder_enabled = updates.reminder_enabled;
    }

    if (updates.reminder_days_before !== undefined) {
      data.reminder_days_before = updates.reminder_days_before;
    }

    if (updates.reminder_time !== undefined) {
      data.reminder_time = updates.reminder_time;
    }

    if (updates.reminder_config !== undefined) {
      data.reminder_config = updates.reminder_config as Prisma.InputJsonValue;
    }

    return data;
  }

  async updateOwned(id: string, userId: string, updates: BillUpdateInput) {
    const owned = await this.prisma.bill.findFirst({
      where: { id, user_id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!owned) {
      return null;
    }

    const rec = await this.prisma.bill.update({
      where: { id },
      data: this.buildUpdateData(updates),
    });

    return this.map(rec as unknown as BillRecord);
  }

  async softDeleteOwned(id: string, userId: string) {
    const owned = await this.prisma.bill.findFirst({
      where: { id, user_id: userId, deleted_at: null },
      select: { id: true },
    });
    if (!owned) {
      return false;
    }

    await this.prisma.bill.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
    });
    return true;
  }
}
