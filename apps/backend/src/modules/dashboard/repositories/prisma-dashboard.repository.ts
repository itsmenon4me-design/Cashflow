import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IDashboardRepository } from '../interfaces/dashboard.repository.interface';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<DashboardSummaryResponseDto> {
    // Use aggregates to compute counts and sums efficiently

    // Total assets: sum of account.current_balance (stored as bigint/string)
    const accountsAgg = await this.prisma.account.aggregate({
      where: { user_id: userId, deleted_at: null },
      _sum: { current_balance_cents: true },
      _count: { id: true },
      _max: { updated_at: true },
    });

    // Transactions counts and sums for current month
    const txIncomeAgg = await this.prisma.transaction.aggregate({
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: TransactionType.INCOME,
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount_cents: true },
      _count: { id: true },
      _max: { updated_at: true },
    });

    const txExpenseAgg = await this.prisma.transaction.aggregate({
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: TransactionType.EXPENSE,
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount_cents: true },
      _count: { id: true },
      _max: { updated_at: true },
    });

    // Total categories count (exclude deleted)
    const catsCount = await this.prisma.category.count({
      where: { user_id: userId, deleted_at: null },
    });

    // Total transactions count (all time, excluding deleted)
    const txTotalCount = await this.prisma.transaction.count({
      where: { user_id: userId, deleted_at: null },
    });

    // Build last_updated_at as the latest of accounts.updated_at, transactions.updated_at
    const candidates: Date[] = [];
    if (accountsAgg._max && accountsAgg._max.updated_at)
      candidates.push(accountsAgg._max.updated_at);
    if (txIncomeAgg._max && txIncomeAgg._max.updated_at)
      candidates.push(txIncomeAgg._max.updated_at);
    if (txExpenseAgg._max && txExpenseAgg._max.updated_at)
      candidates.push(txExpenseAgg._max.updated_at);

    const lastUpdatedAt =
      candidates.length > 0
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : null;

    const totalAssets = accountsAgg._sum?.current_balance_cents ?? 0;
    const income = txIncomeAgg._sum?.amount_cents ?? 0;
    const expense = txExpenseAgg._sum?.amount_cents ?? 0;

    // Ensure bigint/string normalization: Prisma may return BigInt or string
    const normalize = (v: any): string => {
      if (v === null || v === undefined) return '0';
      if (typeof v === 'bigint') return v.toString();
      if (typeof v === 'number') return String(Math.round(v));
      return String(v);
    };

    const dto = new DashboardSummaryResponseDto({
      total_assets_cents: normalize(totalAssets),
      total_income_cents: normalize(income),
      total_expense_cents: normalize(expense),
      net_cash_flow_cents: normalize(
        (BigInt(normalize(income)) - BigInt(normalize(expense))).toString(),
      ),
      total_accounts: accountsAgg._count?.id ?? 0,
      total_categories: catsCount ?? 0,
      total_transactions: txTotalCount ?? 0,
      last_updated_at: lastUpdatedAt,
    });

    return dto;
  }
}
