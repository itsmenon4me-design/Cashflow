import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IBudgetsRepository } from './budgets.repository.interface';
import { BudgetEntity } from '../entities/budget.entity';
import type { Prisma } from '../../../generated/prisma/client';

type BudgetRec = {
  id: string;
  user_id: string;
  category_id: string;
  currency: string | null;
  budget_amount_cents: bigint;
  month: number;
  year: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  category?: { name?: string | null } | null;
};

@Injectable()
export class PrismaBudgetsRepository implements IBudgetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: BudgetRec): BudgetEntity {
    const b = new BudgetEntity();
    b.id = rec.id;
    b.user_id = rec.user_id;
    b.category_id = rec.category_id;
    b.currency = rec.currency ?? null;
    b.budget_amount_cents =
      typeof rec.budget_amount_cents === 'bigint'
        ? rec.budget_amount_cents
        : BigInt(String(rec.budget_amount_cents ?? 0));
    b.month = rec.month;
    b.year = rec.year;
    b.created_at = rec.created_at;
    b.updated_at = rec.updated_at;
    b.deleted_at = rec.deleted_at ?? null;
    b.category_name = rec.category?.name ?? null;
    return b;
  }

  async create(input: Partial<BudgetEntity>): Promise<BudgetEntity> {
    const data = {
      user_id: input.user_id!,
      category_id: input.category_id!,
      currency: input.currency ?? null,
      budget_amount_cents:
        typeof input.budget_amount_cents === 'bigint'
          ? input.budget_amount_cents
          : BigInt(String(input.budget_amount_cents ?? 0)),
      month: input.month!,
      year: input.year!,
    } as Prisma.BudgetUncheckedCreateInput;

    const rec = await this.prisma.budget.create({
      data,
    });
    return this.map(rec);
  }

  async findById(id: string, currency?: string): Promise<BudgetEntity | null> {
    // Currency is display-scoping only — never hide rows by it.
    void currency;
    const rec = await this.prisma.budget.findFirst({
      where: { id },
      include: { category: { select: { name: true } } },
    });
    if (!rec || rec.deleted_at) return null;
    return this.map(rec);
  }

  async findAllByUser(
    userId: string,
    currency?: string,
  ): Promise<BudgetEntity[]> {
    void currency;
    const where: Prisma.BudgetWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    const recs = await this.prisma.budget.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return (recs as unknown as BudgetRec[]).map((r) => this.map(r));
  }

  async findByUserAndCategoryAndPeriod(
    userId: string,
    categoryId: string,
    month: number,
    year: number,
    currency?: string,
  ): Promise<BudgetEntity | null> {
    const where: Prisma.BudgetWhereInput = {
      user_id: userId,
      category_id: categoryId,
      month,
      year,
      deleted_at: null,
    };
    if (currency) {
      where.OR = [{ currency }, { currency: null }];
    }
    const rec = await this.prisma.budget.findFirst({
      where,
    });
    return rec ? this.map(rec) : null;
  }

  async update(
    id: string,
    updates: Partial<BudgetEntity>,
  ): Promise<BudgetEntity> {
    const data: Prisma.BudgetUncheckedUpdateInput = {};
    if (updates.category_id !== undefined)
      data.category_id = updates.category_id;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.budget_amount_cents !== undefined)
      data.budget_amount_cents =
        typeof updates.budget_amount_cents === 'bigint'
          ? updates.budget_amount_cents
          : BigInt(String(updates.budget_amount_cents));
    if (updates.month !== undefined) data.month = updates.month;
    if (updates.year !== undefined) data.year = updates.year;

    const rec = await this.prisma.budget.update({
      where: { id },
      data,
      include: { category: { select: { name: true } } },
    });
    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.budget.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
