import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { toMinorUnitsExact } from '../../../common/types/money';

export type TrendType = 'daily' | 'weekly' | 'monthly';

export interface TrendPoint {
  period: string;
  /** Exact minor units as strings (BigInt-safe at the API boundary). */
  income: string;
  expense: string;
  netCashFlow: string;
}

export interface TrendResult {
  type: TrendType;
  data: TrendPoint[];
}

@Injectable()
export class CashflowTrendService {
  constructor(private readonly prisma: PrismaService) {}

  // Resolve primary account currency so income/expense/net aggregates never
  // mix different currencies (Phase C multi-currency rule).
  private async resolveTargetCurrency(userId: string): Promise<string> {
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    return defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
  }

  private validateDates(start: Date, end: Date) {
    if (!(start instanceof Date) || isNaN(start.getTime()))
      throw new BadRequestException('Invalid startDate');
    if (!(end instanceof Date) || isNaN(end.getTime()))
      throw new BadRequestException('Invalid endDate');
    if (start.getTime() > end.getTime())
      throw new BadRequestException('startDate must be before endDate');
  }

  private getPeriodKey(date: Date, type: TrendType): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    if (type === 'daily') return `${y}-${m}-${d}`;
    if (type === 'monthly') return `${y}-${m}`;
    // weekly: compute ISO week number
    const tmp = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    // ISO week date weeks start on Monday
    const dayNum = tmp.getUTCDay() || 7; // Sunday is 0 -> 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  async getTrend(
    userId: string,
    type: TrendType,
    startDate: Date,
    endDate: Date,
  ): Promise<TrendResult> {
    if (type !== 'daily' && type !== 'weekly' && type !== 'monthly')
      throw new BadRequestException('Invalid type');
    this.validateDates(startDate, endDate);

    const targetCurrency = await this.resolveTargetCurrency(userId);

    // fetch transactions in range (single currency only)
    const recs = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        account: { currency: targetCurrency },
        transaction_date: { gte: startDate, lte: endDate },
      },
      select: {
        transaction_date: true,
        transaction_type: true,
        amount_cents: true,
      },
    });

    if (!recs || recs.length === 0) return { type, data: [] };

    const map = new Map<
      string,
      { income: bigint; expense: bigint; count: number }
    >();

    for (const r of recs) {
      const dt = r.transaction_date;
      const key = this.getPeriodKey(new Date(dt), type);
      const entry = map.get(key) ?? { income: 0n, expense: 0n, count: 0 };
      const amt = toMinorUnitsExact(r.amount_cents);
      if (String(r.transaction_type).toUpperCase() === 'INCOME')
        entry.income += amt;
      else entry.expense += amt;
      entry.count += 1;
      map.set(key, entry);
    }

    // convert map to array and sort chronologically by period key
    const data: TrendPoint[] = Array.from(map.entries())
      .map(([period, v]) => ({
        period,
        income: v.income.toString(),
        expense: v.expense.toString(),
        netCashFlow: (v.income - v.expense).toString(),
      }))
      .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));

    return { type, data };
  }
}
