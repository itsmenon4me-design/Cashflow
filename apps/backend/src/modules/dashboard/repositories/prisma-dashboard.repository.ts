import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IDashboardRepository } from '../interfaces/dashboard.repository.interface';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '../../../generated/prisma/client';
import { FIXED_CURRENCY } from '../../../common/currencies';
import { toMinorUnitsExact } from '../../../common/types/money';
import { DateHelper } from '../../../common/utils/date.util';

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
    const [txIncome, txExpense, allTimeIncome, allTimeExpense, previousIncome, previousExpense, catsCount, txTotalCount] =
      await Promise.all([
        this.prisma.transaction.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            transaction_date: { gte: monthStart, lte: monthEnd },
          },
          select: {
            amount_cents: true,
            updated_at: true,
          },
        }),
        this.prisma.transaction.findMany({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            transaction_date: { gte: monthStart, lte: monthEnd },
          },
          select: {
            amount_cents: true,
            updated_at: true,
          },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.INCOME,
            transaction_date: { gte: previousMonthStart, lt: monthStart },
          },
          _sum: { amount_cents: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_type: TransactionType.EXPENSE,
            transaction_date: { gte: previousMonthStart, lt: monthStart },
          },
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

    let income = 0n;
    let expense = 0n;

    for (const tx of txIncome) {
      income += toMinorUnitsExact(tx.amount_cents);
    }

    for (const tx of txExpense) {
      expense += toMinorUnitsExact(tx.amount_cents);
    }

    const candidates: Date[] = [];
    for (const t of txIncome) if (t.updated_at) candidates.push(t.updated_at);
    for (const t of txExpense) if (t.updated_at) candidates.push(t.updated_at);

    const lastUpdatedAt =
      candidates.length > 0
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : null;

    const netCashFlow = income - expense;
    const balance =
      toMinorUnitsExact(allTimeIncome._sum.amount_cents) -
      toMinorUnitsExact(allTimeExpense._sum.amount_cents);
    const previousNetCashFlow =
      toMinorUnitsExact(previousIncome._sum.amount_cents) -
      toMinorUnitsExact(previousExpense._sum.amount_cents);

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
