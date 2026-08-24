import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IInvestmentsRepository } from './investments.repository.interface';
import { InvestmentEntity } from '../entities/investment.entity';
import type { Prisma } from '../../../generated/prisma/client';

type InvRec = {
  id: string;
  user_id: string;
  account_id: string | null;
  currency: string | null;
  investment_type: string;
  platform: string;
  name: string;
  symbol: string | null;
  quantity: { toString(): string };
  average_buy_price: { toString(): string };
  current_price: { toString(): string };
  invested_amount_cents: bigint;
  current_value_cents: bigint;
  profit_loss_cents: bigint;
  profit_loss_percentage: { toString(): string };
  purchase_date: Date;
  notes: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

@Injectable()
export class PrismaInvestmentsRepository implements IInvestmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(rec: InvRec): InvestmentEntity {
    const i = new InvestmentEntity();
    i.id = rec.id;
    i.user_id = rec.user_id;
    i.account_id = rec.account_id ?? null;
    i.currency = rec.currency ?? null;
    i.investment_type =
      rec.investment_type as InvestmentEntity['investment_type'];
    i.platform = rec.platform;
    i.name = rec.name;
    i.symbol = rec.symbol ?? null;
    i.quantity = rec.quantity.toString();
    i.average_buy_price = rec.average_buy_price.toString();
    i.current_price = rec.current_price.toString();
    i.invested_amount_cents = BigInt(String(rec.invested_amount_cents ?? 0));
    i.current_value_cents = BigInt(String(rec.current_value_cents ?? 0));
    i.profit_loss_cents = BigInt(String(rec.profit_loss_cents ?? 0));
    i.profit_loss_percentage = rec.profit_loss_percentage.toString();
    i.purchase_date = rec.purchase_date;
    i.notes = rec.notes ?? null;
    i.status = rec.status as InvestmentEntity['status'];
    i.created_at = rec.created_at;
    i.updated_at = rec.updated_at;
    i.deleted_at = rec.deleted_at ?? null;
    return i;
  }

  async create(input: Partial<InvestmentEntity>): Promise<InvestmentEntity> {
    const rec = await this.prisma.investment.create({
      data: {
        user_id: input.user_id!,
        account_id: input.account_id ?? null,
        currency: input.currency ?? null,
        investment_type: input.investment_type!,
        platform: input.platform!,
        name: input.name!,
        symbol: input.symbol ?? null,
        quantity: input.quantity!,
        average_buy_price: input.average_buy_price!,
        current_price: input.current_price!,
        invested_amount_cents: BigInt(String(input.invested_amount_cents ?? 0)),
        current_value_cents: BigInt(String(input.current_value_cents ?? 0)),
        profit_loss_cents: BigInt(String(input.profit_loss_cents ?? 0)),
        profit_loss_percentage: input.profit_loss_percentage ?? '0',
        purchase_date: input.purchase_date!,
        notes: input.notes ?? null,
        status: input.status ?? 'ACTIVE',
      },
    });
    return this.map(rec);
  }

  async findById(id: string, currency?: string): Promise<InvestmentEntity | null> {
    // Each currency is its own ledger; legacy rows without currency stay
    // visible in every ledger until the backfill assigns them one.
    const where: Prisma.InvestmentWhereInput = { id };
    if (currency) {
      where.OR = [{ currency }, { account: { currency } }];
    }
    const rec = await this.prisma.investment.findFirst({ where });
    if (!rec || rec.deleted_at) return null;
    return this.map(rec);
  }

  async findAllByUser(userId: string, currency?: string): Promise<InvestmentEntity[]> {
    const where: any = { user_id: userId, deleted_at: null };
    if (currency) {
      where.OR = [{ currency }, { account: { currency } }];
    }
    const recs = await this.prisma.investment.findMany({
      where,
      orderBy: { purchase_date: 'desc' },
    });
    return (recs as unknown as InvRec[]).map((rec) => this.map(rec));
  }

  async update(
    id: string,
    updates: Partial<InvestmentEntity>,
  ): Promise<InvestmentEntity> {
    const data: Prisma.InvestmentUncheckedUpdateInput = {};
    if (updates.account_id !== undefined) data.account_id = updates.account_id;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.investment_type !== undefined)
      data.investment_type = updates.investment_type;
    if (updates.platform !== undefined) data.platform = updates.platform;
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.symbol !== undefined) data.symbol = updates.symbol;
    if (updates.quantity !== undefined)
      data.quantity = String(updates.quantity);
    if (updates.average_buy_price !== undefined)
      data.average_buy_price = String(updates.average_buy_price);
    if (updates.current_price !== undefined)
      data.current_price = String(updates.current_price);
    if (updates.invested_amount_cents !== undefined)
      data.invested_amount_cents = BigInt(
        String(updates.invested_amount_cents),
      );
    if (updates.current_value_cents !== undefined)
      data.current_value_cents = BigInt(String(updates.current_value_cents));
    if (updates.profit_loss_cents !== undefined)
      data.profit_loss_cents = BigInt(String(updates.profit_loss_cents));
    if (updates.profit_loss_percentage !== undefined)
      data.profit_loss_percentage = String(updates.profit_loss_percentage);
    if (updates.purchase_date !== undefined)
      data.purchase_date = updates.purchase_date;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.status !== undefined) data.status = updates.status;

    const rec = await this.prisma.investment.update({ where: { id }, data });
    return this.map(rec);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.investment.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
