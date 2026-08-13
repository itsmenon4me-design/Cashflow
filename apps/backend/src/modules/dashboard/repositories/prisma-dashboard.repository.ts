import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IDashboardRepository } from '../interfaces/dashboard.repository.interface';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '../../../generated/prisma/client';

@Injectable()
export class PrismaDashboardRepository implements IDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    userId: string,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<DashboardSummaryResponseDto> {
    // 1. Fetch user accounts grouped by currency
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, currency: true, current_balance_cents: true, is_default: true, updated_at: true },
    });

    // 2. Fetch income transactions with account currency
    const txIncome = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: TransactionType.INCOME,
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount_cents: true, updated_at: true, account: { select: { currency: true } } },
    });

    // 3. Fetch expense transactions with account currency
    const txExpense = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        transaction_type: TransactionType.EXPENSE,
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount_cents: true, updated_at: true, account: { select: { currency: true } } },
    });

    // 4. Total counts
    const catsCount = await this.prisma.category.count({
      where: { user_id: userId, deleted_at: null },
    });
    const txTotalCount = await this.prisma.transaction.count({
      where: { user_id: userId, deleted_at: null },
    });

    // 5. Aggregate per currency
    const currencyMap = new Map<
      string,
      { assets: bigint; income: bigint; expense: bigint }
    >();

    // Map account balances
    for (const acc of accounts) {
      const curr = acc.currency ?? 'IDR';
      const entry = currencyMap.get(curr) ?? { assets: 0n, income: 0n, expense: 0n };
      const bal = typeof acc.current_balance_cents === 'bigint' ? acc.current_balance_cents : BigInt(acc.current_balance_cents ?? 0);
      entry.assets += bal;
      currencyMap.set(curr, entry);
    }

    // Map income
    for (const tx of txIncome) {
      const curr = tx.account?.currency ?? 'IDR';
      const entry = currencyMap.get(curr) ?? { assets: 0n, income: 0n, expense: 0n };
      const amt = typeof tx.amount_cents === 'bigint' ? tx.amount_cents : BigInt(tx.amount_cents ?? 0);
      entry.income += amt;
      currencyMap.set(curr, entry);
    }

    // Map expense
    for (const tx of txExpense) {
      const curr = tx.account?.currency ?? 'IDR';
      const entry = currencyMap.get(curr) ?? { assets: 0n, income: 0n, expense: 0n };
      const amt = typeof tx.amount_cents === 'bigint' ? tx.amount_cents : BigInt(tx.amount_cents ?? 0);
      entry.expense += amt;
      currencyMap.set(curr, entry);
    }

    // Default to IDR if no accounts exist
    if (currencyMap.size === 0) {
      currencyMap.set('IDR', { assets: 0n, income: 0n, expense: 0n });
    }

    // Determine primary currency (default account currency, or first currency in map)
    const defaultAcc = accounts.find((a) => a.is_default);
    const primaryCurrency = defaultAcc?.currency ?? Array.from(currencyMap.keys())[0] ?? 'IDR';

    // Build per-currency list
    const byCurrency = Array.from(currencyMap.entries()).map(([curr, data]) => ({
      currency: curr,
      total_assets_cents: data.assets.toString(),
      total_income_cents: data.income.toString(),
      total_expense_cents: data.expense.toString(),
      net_cash_flow_cents: (data.income - data.expense).toString(),
    }));

    const primaryData = currencyMap.get(primaryCurrency) ?? { assets: 0n, income: 0n, expense: 0n };

    // Build last_updated_at
    const candidates: Date[] = [];
    for (const a of accounts) if (a.updated_at) candidates.push(a.updated_at);
    for (const t of txIncome) if (t.updated_at) candidates.push(t.updated_at);
    for (const t of txExpense) if (t.updated_at) candidates.push(t.updated_at);

    const lastUpdatedAt =
      candidates.length > 0
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : null;

    return new DashboardSummaryResponseDto({
      currency: primaryCurrency,
      total_assets_cents: primaryData.assets.toString(),
      total_income_cents: primaryData.income.toString(),
      total_expense_cents: primaryData.expense.toString(),
      net_cash_flow_cents: (primaryData.income - primaryData.expense).toString(),
      total_accounts: accounts.length,
      total_categories: catsCount,
      total_transactions: txTotalCount,
      last_updated_at: lastUpdatedAt,
      by_currency: byCurrency,
    });
  }
}
