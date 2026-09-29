import { Injectable } from '@nestjs/common';
import { DateHelper } from '../../../common/utils/date.util';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { toMinorUnitsExact } from '../../../common/types/money';
import { resolveUserTimezone } from '../../../common/utils/user-timezone.util';

export interface AnalyticsResult {
  /** Exact minor units as strings (BigInt-safe at the API boundary). */
  income: string;
  expense: string;
  netCashFlow: string;
  comparison: {
    income: number | null;
    expense: number | null;
    netCashFlow: number | null;
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
    startDate?: Date | string,
    endDate?: Date | string,
  ): Promise<AnalyticsResult> {
    const now = new Date();
    const timeZone = await resolveUserTimezone(this.prisma, userId);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart =
        startDate instanceof Date
          ? startDate
          : /^\d{4}-\d{2}-\d{2}$/.test(startDate)
            ? DateHelper.startOfDayInTimezone(startDate, timeZone)
            : new Date(startDate);
      rangeEnd =
        endDate instanceof Date
          ? endDate
          : /^\d{4}-\d{2}-\d{2}$/.test(endDate)
            ? DateHelper.endOfDayInTimezone(endDate, timeZone)
            : new Date(endDate);
    } else {
      // current month
      rangeStart = DateHelper.startOfMonthInTimezone(now, timeZone);
      rangeEnd = DateHelper.endOfMonthInTimezone(now, timeZone);
    }

    const previousRange = DateHelper.previousPeriodInTimezone(
      rangeStart,
      rangeEnd,
      timeZone,
    );

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
    const previous = await aggFor(previousRange.start, previousRange.end);

    const income = current.inc;
    const expense = current.exp;
    const net = income - expense;

    const calcPct = (curr: bigint, prev: bigint): number | null => {
      if (prev === 0n) return null;
      const diff = Number(curr - prev);
      const denominator = Number(prev < 0n ? -prev : prev);
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
