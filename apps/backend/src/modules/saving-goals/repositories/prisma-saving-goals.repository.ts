import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ISavingGoalsRepository } from './saving-goals.repository.interface';
import { SavingGoalEntity } from '../entities/saving-goal.entity';
import type { Prisma } from '../../../generated/prisma/client';

type GoalRec = {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  currency: string | null;
  name: string;
  description: string | null;
  target_amount_cents: bigint;
  current_amount_cents: bigint;
  start_date: Date;
  target_date: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

@Injectable()
export class PrismaSavingGoalsRepository implements ISavingGoalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: GoalRec): SavingGoalEntity {
    const g = new SavingGoalEntity();
    g.id = rec.id;
    g.user_id = rec.user_id;
    g.account_id = rec.account_id ?? null;
    g.category_id = rec.category_id ?? null;
    g.currency = rec.currency ?? null;
    g.name = rec.name;
    g.description = rec.description ?? null;
    g.target_amount_cents = BigInt(String(rec.target_amount_cents ?? 0));
    g.current_amount_cents = BigInt(String(rec.current_amount_cents ?? 0));
    g.start_date = rec.start_date;
    g.target_date = rec.target_date;
    g.status = rec.status as SavingGoalEntity['status'];
    g.created_at = rec.created_at;
    g.updated_at = rec.updated_at;
    g.deleted_at = rec.deleted_at ?? null;
    return g;
  }

  async create(input: Partial<SavingGoalEntity>): Promise<SavingGoalEntity> {
    const rec = await this.prisma.savingGoal.create({
      data: {
        user_id: input.user_id!,
        name: input.name!,
        account_id: input.account_id ?? null,
        category_id: input.category_id ?? null,
        currency: input.currency ?? null,
        description: input.description ?? null,
        target_amount_cents: BigInt(String(input.target_amount_cents ?? 0)),
        current_amount_cents: BigInt(String(input.current_amount_cents ?? 0)),
        start_date: input.start_date!,
        target_date: input.target_date!,
        status: input.status ?? 'ACTIVE',
      },
    });
    return this.map(rec);
  }

  async findById(id: string, currency?: string): Promise<SavingGoalEntity | null> {
    // ponytail: currency is display-scoping only — ownership via user_id in service layer.
    // Ignore the hint so records in other (or absent) currencies stay manageable.
    void currency;
    const rec = await this.prisma.savingGoal.findFirst({ where: { id } });
    if (!rec || rec.deleted_at) return null;
    return this.map(rec);
  }

  async findAllByUser(
    userId: string,
    currency?: string,
  ): Promise<SavingGoalEntity[]> {
    // Currency must never hide rows (display concern, not a data filter).
    void currency;
    const where: Prisma.SavingGoalWhereInput = {
      user_id: userId,
      deleted_at: null,
    };
    const recs = await this.prisma.savingGoal.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return (recs as unknown as GoalRec[]).map((rec) => this.map(rec));
  }

  async update(
    id: string,
    updates: Partial<SavingGoalEntity>,
  ): Promise<SavingGoalEntity> {
    const data: Prisma.SavingGoalUncheckedUpdateInput = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.account_id !== undefined) data.account_id = updates.account_id;
    if (updates.category_id !== undefined)
      data.category_id = updates.category_id;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.target_amount_cents !== undefined)
      data.target_amount_cents = BigInt(String(updates.target_amount_cents));
    if (updates.current_amount_cents !== undefined)
      data.current_amount_cents = BigInt(String(updates.current_amount_cents));
    if (updates.start_date !== undefined) data.start_date = updates.start_date;
    if (updates.target_date !== undefined)
      data.target_date = updates.target_date;
    if (updates.status !== undefined) data.status = updates.status;

    const rec = await this.prisma.savingGoal.update({ where: { id }, data });
    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.savingGoal.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
