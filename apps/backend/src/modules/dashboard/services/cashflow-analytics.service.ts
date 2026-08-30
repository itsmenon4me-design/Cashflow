import { Injectable } from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
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
      rangeStart = DateHelper.startOfMonth();
      rangeEnd = DateHelper.endOfMonth();
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
      const inc = toMinorUnitsExact(incAgg._sum?.amount_cents);
      const exp = toMinorUnitsExact(expAgg._sum?.amount_cents);
      return { inc, exp };
    };

    const current = await aggFor(rangeStart, rangeEnd);
    const previous = await aggFor(prevStart, prevEnd);

    const income = current.inc;
    const expense = current.exp;
    const net = income - expense;

    const calcPct = (curr: bigint, prev: bigint): number => {
      if (prev === 0n) return 0;
      const diff = Number(curr - prev);
      const denominator = Number(prev);
      const rawPct = (diff / denominator) * 100;
      return Math.round(rawPct * 100) / 100;
    };

    const compIncome = calcPct(income, previous.inc);
    const compExpense = calcPct(expense, previous.exp);
    const prevNet = previous.inc - previous.exp;
    const compNet = calcPct(net, prevNet);

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
