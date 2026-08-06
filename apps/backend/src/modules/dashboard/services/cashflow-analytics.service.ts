import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '@prisma/client';

export interface AnalyticsResult {
  income: number;
  expense: number;
  netCashFlow: number;
  comparison: {
    income: number;
    expense: number;
    netCashFlow: number;
  };
}

@Injectable()
export class CashflowAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeToNumber(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    }
    if (typeof v === 'number') return v;
    return 0;
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return 0; // Prevent division by zero
    return Number(((current - previous) / Math.abs(previous)) * 100);
  }

  /**
   * Calculate analytics for a given user and date range.
   * If startDate/endDate are omitted, default to current month vs previous month.
   */
  async getAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsResult> {
    const now = new Date();

    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart = startDate;
      rangeEnd = endDate;
    } else {
      // current month
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
    }

    // previous range of same length
    const lenMs = rangeEnd.getTime() - rangeStart.getTime() + 1;
    const prevEnd = new Date(rangeStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lenMs + 1);

    // helper to aggregate
    const aggFor = async (start: Date, end: Date) => {
      const [incAgg, expAgg] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            transaction_date: { gte: start, lte: end },
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            transaction_date: { gte: start, lte: end },
          },
          _sum: { amount_cents: true },
        }),
      ]);
      const inc = this.normalizeToNumber(incAgg._sum?.amount_cents ?? 0);
      const exp = this.normalizeToNumber(expAgg._sum?.amount_cents ?? 0);
      return { inc, exp };
    };

    const current = await aggFor(rangeStart, rangeEnd);
    const previous = await aggFor(prevStart, prevEnd);

    const income = current.inc;
    const expense = current.exp;
    const net = income - expense;

    const compIncome = this.percentChange(income, previous.inc);
    const compExpense = this.percentChange(expense, previous.exp);
    const compNet = this.percentChange(net, previous.inc - previous.exp);

    return {
      income,
      expense,
      netCashFlow: net,
      comparison: {
        income: Number(compIncome.toFixed(2)),
        expense: Number(compExpense.toFixed(2)),
        netCashFlow: Number(compNet.toFixed(2)),
      },
    };
  }
}
