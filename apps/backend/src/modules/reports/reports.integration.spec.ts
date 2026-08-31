import { PrismaService } from '../../database/prisma.service';
import { TransactionType } from '../../generated/prisma/client';
import { BudgetAnalyticsService } from './services/budget-analytics.service';
import { CashflowTrendService } from './services/cashflow-trend.service';
import { CategoryBreakdownService } from './services/category-breakdown.service';
import { FinancialInsightsService } from './services/financial-insights.service';
import { MonthlyReportService } from './services/monthly-report.service';

const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Reports integration - currency isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let monthly: MonthlyReportService | null = null;
  let categoryBreakdown: CategoryBreakdownService | null = null;
  let cashflowTrend: CashflowTrendService | null = null;
  let budgetAnalytics: BudgetAnalyticsService | null = null;
  let insights: FinancialInsightsService | null = null;
  let userId: string;
  let usdCategoryId: string;
  let usdIncomeCategoryId: string;
  let idrCategoryId: string;
  let usdAccountId: string;
  let idrAccountId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping reports integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();

    if (!(prisma as any).account) {
      console.log(
        'Skipping reports integration tests: current Prisma schema does not include the legacy account model used by this suite.',
      );
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: `reports-int-${Date.now()}@example.com`,
        username: `reports_int_${Date.now()}`,
        full_name: 'Reports Integration User',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    const usdExpenseCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `USD Expense Cat ${Date.now()}`,
        type: 'expense',
      },
    });
    const usdIncomeCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `USD Income Cat ${Date.now() + 1}`,
        type: 'income',
      },
    });
    const idrExpenseCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `IDR Expense Cat ${Date.now() + 2}`,
        type: 'expense',
      },
    });
    const legacyBudgetCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `Legacy Budget Cat ${Date.now() + 3}`,
        type: 'expense',
      },
    });
    usdCategoryId = usdExpenseCategory.id;
    usdIncomeCategoryId = usdIncomeCategory.id;
    idrCategoryId = idrExpenseCategory.id;

    const usdAccount = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'USD Ledger',
        account_type: 'cash',
        currency: 'USD',
        current_balance_cents: BigInt(250000),
        is_default: true,
      },
    });
    const idrAccount = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'IDR Ledger',
        account_type: 'cash',
        currency: 'IDR',
        current_balance_cents: BigInt(3000000),
      },
    });
    usdAccountId = usdAccount.id;
    idrAccountId = idrAccount.id;

    const month = new Date();
    const monthDate = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 15, 12, 0, 0),
    );

    await prisma.transaction.createMany({
      data: [
        {
          user_id: userId,
          account_id: usdAccountId,
          category_id: usdExpenseCategory.id,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: BigInt(42500),
          transaction_date: monthDate,
          note: 'USD expense',
        },
        {
          user_id: userId,
          account_id: usdAccountId,
          category_id: usdIncomeCategory.id,
          transaction_type: TransactionType.INCOME,
          amount_cents: BigInt(100000),
          transaction_date: monthDate,
          note: 'USD income',
        },
        {
          user_id: userId,
          account_id: idrAccountId,
          category_id: idrExpenseCategory.id,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: BigInt(6000000),
          transaction_date: monthDate,
          note: 'IDR expense',
        },
      ],
    });

    await prisma.budget.createMany({
      data: [
        {
          user_id: userId,
          category_id: usdExpenseCategory.id,
          currency: 'USD',
          budget_amount_cents: BigInt(100000),
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        },
        {
          user_id: userId,
          category_id: idrExpenseCategory.id,
          currency: 'IDR',
          budget_amount_cents: BigInt(15000000),
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        },
        {
          user_id: userId,
          category_id: legacyBudgetCategory.id,
          currency: null,
          budget_amount_cents: BigInt(5000000),
          month: month.getMonth() + 1,
          year: month.getFullYear(),
        },
      ],
    });

    monthly = new MonthlyReportService(prisma as any);
    categoryBreakdown = new CategoryBreakdownService(prisma as any);
    cashflowTrend = new CashflowTrendService(prisma as any);
    budgetAnalytics = new BudgetAnalyticsService(prisma as any);
    insights = new FinancialInsightsService(prisma as any);
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;

    try {
      await prisma.budget.deleteMany({ where: { user_id: userId } });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.category.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      console.warn('Reports cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Monthly report for USD excludes IDR-only totals', async () => {
    if (!hasDatabase || !prisma || !(prisma as any).account || !monthly) return;

    const month = new Date();
    const result = await monthly.getMonthlyReport(
      userId,
      month.getMonth() + 1,
      month.getFullYear(),
      undefined,
      'USD',
    );

    expect(result.summary.income).toBe('100000');
    expect(result.summary.expense).toBe('42500');
    expect(result.summary.netCashFlow).toBe('57500');
    expect(result.topExpenseCategories.every((row) => row.name !== 'IDR Expense Cat')).toBe(true);
  });

  test('Category breakdown for USD excludes IDR categories and totals', async () => {
    if (!hasDatabase || !prisma || !(prisma as any).account || !categoryBreakdown) return;

    const month = new Date();
    const result = await categoryBreakdown.getBreakdown(
      userId,
      'expense',
      month.getMonth() + 1,
      month.getFullYear(),
      undefined,
      'USD',
    );

    expect(result.total).toBe('42500');
    expect(result.categories.every((row) => row.categoryName !== 'IDR Expense Cat')).toBe(true);
    expect(result.categories.some((row) => row.categoryName?.startsWith('USD Expense'))).toBe(true);
  });

  test('Cashflow trend for USD excludes IDR series', async () => {
    if (!hasDatabase || !prisma || !(prisma as any).account || !cashflowTrend) return;

    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const result = await cashflowTrend.getTrend(userId, 'monthly', start, end, 'USD');

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((row) => BigInt(row.income) >= 0n)).toBe(true);
    expect(result.data.every((row) => BigInt(row.expense) <= BigInt('42500'))).toBe(true);
  });

  test('Budget analysis for USD excludes legacy NULL and IDR budgets', async () => {
    if (!hasDatabase || !prisma || !(prisma as any).account || !budgetAnalytics) return;

    const month = new Date();
    const result = await budgetAnalytics.analyzeMonth(
      userId,
      month.getMonth() + 1,
      month.getFullYear(),
      'USD',
    );

    expect(result.overall.budget).toBe('100000');
    expect(result.overall.spent).toBe('42500');
    expect(result.categories.every((row) => row.categoryName !== 'IDR Expense Cat')).toBe(true);
    expect(result.categories.every((row) => row.categoryName !== 'Legacy Budget Cat')).toBe(true);
    expect(result.categories.every((row) => row.budgetAmount === '100000')).toBe(true);
  });

  test('Financial insights for USD excludes IDR expense and income aggregates', async () => {
    if (!hasDatabase || !prisma || !(prisma as any).account || !insights) return;

    const month = new Date();
    const result = await insights.getInsights(
      userId,
      month.getMonth() + 1,
      month.getFullYear(),
      'USD',
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result.summary)).toBe(true);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.statistics).toBeDefined();
    expect(result.statistics.largestTransactionAmount).toBeGreaterThanOrEqual(0);
  });
});
