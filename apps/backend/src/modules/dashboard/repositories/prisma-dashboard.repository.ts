import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IDashboardRepository } from '../interfaces/dashboard.repository.interface';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '../../../generated/prisma/client';
import { FIXED_CURRENCY } from '../../../common/currencies';

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<DashboardSummaryResponseDto> {
    const txIncome = await this.prisma.transaction.findMany({
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
    });

    const txExpense = await this.prisma.transaction.findMany({
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
    });

    const catsCount = await this.prisma.category.count({
      where: { user_id: userId, deleted_at: null },
    });
    const txTotalCount = await this.prisma.transaction.count({
      where: {
        user_id: userId,
        deleted_at: null,
      },
    });

    let income = 0n;
    let expense = 0n;

    for (const tx of txIncome) {
      income +=
        typeof tx.amount_cents === 'bigint'
          ? tx.amount_cents
          : BigInt(tx.amount_cents ?? 0);
    }

    for (const tx of txExpense) {
      expense +=
        typeof tx.amount_cents === 'bigint'
          ? tx.amount_cents
          : BigInt(tx.amount_cents ?? 0);
    }

    const candidates: Date[] = [];
    for (const t of txIncome) if (t.updated_at) candidates.push(t.updated_at);
    for (const t of txExpense) if (t.updated_at) candidates.push(t.updated_at);

    const lastUpdatedAt =
      candidates.length > 0
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : null;

    const netCashFlow = income - expense;

    return new DashboardSummaryResponseDto({
      currency: FIXED_CURRENCY,
      total_assets_cents: netCashFlow.toString(),
      total_income_cents: income.toString(),
      total_expense_cents: expense.toString(),
      net_cash_flow_cents: netCashFlow.toString(),
      total_accounts: 0,
      total_categories: catsCount,
      total_transactions: txTotalCount,
      last_updated_at: lastUpdatedAt,
    });
  }
}
