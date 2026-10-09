import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IDashboardRepository } from '../interfaces/dashboard.repository.interface';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '../../../generated/prisma/client';
import { FIXED_CURRENCY } from '../../../common/currencies';
import { toMinorUnitsExact } from '../../../common/types/money';
import { DateHelper } from '../../../common/utils/date.util';

type GroupedTransactionTotals = ReadonlyArray<{
  transaction_type: TransactionType;
  _sum: { amount_cents: bigint | null };
}>;

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
    timeZone: string,
  ): Promise<DashboardSummaryResponseDto> {
    const previousMonthEnd = new Date(monthStart.getTime() - 1);
    const previousMonthStart = DateHelper.startOfMonthInTimezone(
      previousMonthEnd,
      timeZone,
    );
    const [
      monthlyTotals,
      allTimeTotals,
      previousTotals,
      catsCount,
      txTotalCount,
    ] = await Promise.all([
      this.prisma.transaction.groupBy({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_date: { gte: monthStart, lte: monthEnd },
        },
        by: ['transaction_type'],
        _sum: { amount_cents: true },
        _max: { updated_at: true },
      }),
      this.prisma.transaction.groupBy({
        where: {
          user_id: userId,
          deleted_at: null,
        },
        by: ['transaction_type'],
        _sum: { amount_cents: true },
      }),
      this.prisma.transaction.groupBy({
        where: {
          user_id: userId,
          deleted_at: null,
          transaction_date: { gte: previousMonthStart, lt: monthStart },
        },
        by: ['transaction_type'],
        _sum: { amount_cents: true },
      }),
      this.prisma.category.count({
        where: { user_id: userId, deleted_at: null },
      }),
      this.prisma.transaction.count({
        where: {
          user_id: userId,
          deleted_at: null,
        },
      }),
    ]);

    const sumFor = (rows: GroupedTransactionTotals, type: TransactionType) =>
      toMinorUnitsExact(
        rows.find((row) => row.transaction_type === type)?._sum.amount_cents,
      );
    const income = sumFor(monthlyTotals, TransactionType.INCOME);
    const expense = sumFor(monthlyTotals, TransactionType.EXPENSE);
    const allTimeIncomeTotal = sumFor(allTimeTotals, TransactionType.INCOME);
    const allTimeExpenseTotal = sumFor(allTimeTotals, TransactionType.EXPENSE);
    const previousIncome = sumFor(previousTotals, TransactionType.INCOME);
    const previousExpense = sumFor(previousTotals, TransactionType.EXPENSE);
    const candidates = monthlyTotals
      .map((row) => row._max.updated_at)
      .filter((updatedAt): updatedAt is Date => updatedAt !== null);
    const lastUpdatedAt =
      candidates.length > 0
        ? new Date(
            Math.max(...candidates.map((updatedAt) => updatedAt.getTime())),
          )
        : null;

    const netCashFlow = income - expense;
    const balance = allTimeIncomeTotal - allTimeExpenseTotal;
    const previousNetCashFlow = previousIncome - previousExpense;

    return new DashboardSummaryResponseDto({
      currency: FIXED_CURRENCY,
      total_assets_cents: balance.toString(),
      total_income_cents: income.toString(),
      total_expense_cents: expense.toString(),
      net_cash_flow_cents: netCashFlow.toString(),
      previous_net_cash_flow_cents: previousNetCashFlow.toString(),
      total_accounts: 0,
      total_categories: catsCount,
      total_transactions: txTotalCount,
      last_updated_at: lastUpdatedAt,
    });
  }
}
