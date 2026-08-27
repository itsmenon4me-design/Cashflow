import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { toMinorUnitsExact } from '../../../common/types/money';

export interface AnalyticsResult {
  /** Exact minor units as strings (BigInt-safe at the API boundary). */
  income: string;
  expense: string;
  netCashFlow: string;
  comparison: {
    income: number;
    expense: number;
    netCashFlow: number;
  };
}

@Injectable()
export class CashflowAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTargetCurrency(userId: string): Promise<string> {
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    return defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
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

    const targetCurrency = await this.resolveTargetCurrency(userId);

    // helper to aggregate (single currency only)
    const aggFor = async (start: Date, end: Date) => {
      const [incAgg, expAgg] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            account: { currency: targetCurrency },
            transaction_date: { gte: start, lte: end },
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            account: { currency: targetCurrency },
            transaction_date: { gte: start, lte: end },
          },
          _sum: { amount_cents: true },
        }),
      ]);
      const inc = toMinorUnitsExact(incAgg._sum?.amount_cents);
      const exp = toMinorUnitsExact(expAgg._sum?.amount_cents);
      return { inc, exp };
    };

    const current = await aggFor(rangeStart, rangeEnd);
    const previous = await aggFor(prevStart, prevEnd);

    const income = current.inc;
    const expense = current.exp;
    const net = income - expense;

    const compIncome =
      previous.inc === 0n
        ? 0
        : Number((((income - previous.inc) * 100n) / previous.inc).toString());
    const compExpense =
      previous.exp === 0n
        ? 0
        : Number((((expense - previous.exp) * 100n) / previous.exp).toString());
    const prevNet = previous.inc - previous.exp;
    const compNet =
      prevNet === 0n
        ? 0
        : Number((((net - prevNet) * 100n) / prevNet).toString());

    return {
      income: income.toString(),
      expense: expense.toString(),
      netCashFlow: net.toString(),
      comparison: {
        income: compIncome,
        expense: compExpense,
        netCashFlow: compNet,
      },
    };
  }
}
