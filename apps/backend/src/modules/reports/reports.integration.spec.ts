import { PrismaService } from '../../database/prisma.service';
import { TransactionType } from '../../generated/prisma/client';
import { assertIsolatedTestDatabase } from '../../test-utils/assert-isolated-test-database';
import { BudgetAnalyticsService } from './services/budget-analytics.service';
import { FinancialInsightsService } from './services/financial-insights.service';
import { MonthlyReportService } from './services/monthly-report.service';

const dbUrl = process.env.DATABASE_URL || '';

describe('Reports integration - IDR reports', () => {
  let prisma: PrismaService;
  let monthly: MonthlyReportService;
  let budgetAnalytics: BudgetAnalyticsService;
  let insights: FinancialInsightsService;
  let userId: string;
  let categoryIds: Record<'food' | 'transport' | 'utilities' | 'salary' | 'freelance', string>;
  let month: number;
  let year: number;

  beforeAll(async () => {
    if (!dbUrl.trim()) {
      throw new Error('DATABASE_URL is required for reports integration tests');
    }

    assertIsolatedTestDatabase(dbUrl);
    prisma = new PrismaService();
    await prisma.$connect();

    const now = new Date();
    month = now.getUTCMonth() + 1;
    year = now.getUTCFullYear();

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

    const categories = await Promise.all([
      prisma.category.create({
        data: { user_id: userId, name: 'Food', type: 'expense' },
      }),
      prisma.category.create({
        data: { user_id: userId, name: 'Transport', type: 'expense' },
      }),
      prisma.category.create({
        data: { user_id: userId, name: 'Utilities', type: 'expense' },
      }),
      prisma.category.create({
        data: { user_id: userId, name: 'Salary', type: 'income' },
      }),
      prisma.category.create({
        data: { user_id: userId, name: 'Freelance', type: 'income' },
      }),
    ]);
    categoryIds = {
      food: categories[0].id,
      transport: categories[1].id,
      utilities: categories[2].id,
      salary: categories[3].id,
      freelance: categories[4].id,
    };

    const transactionDate = new Date(
      Date.UTC(year, month - 1, 15, 12, 0, 0),
    );
    await prisma.transaction.createMany({
      data: [
        {
          user_id: userId,
          category_id: categoryIds.food,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: 42_500n,
          transaction_date: transactionDate,
          note: 'Food purchase',
        },
        {
          user_id: userId,
          category_id: categoryIds.food,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: 7_500n,
          transaction_date: transactionDate,
          note: 'Food purchase',
        },
        {
          user_id: userId,
          category_id: categoryIds.transport,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: 10_000n,
          transaction_date: transactionDate,
          note: 'Transport',
        },
        {
          user_id: userId,
          category_id: categoryIds.utilities,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: 5_000n,
          transaction_date: transactionDate,
          note: 'Utilities',
        },
        {
          user_id: userId,
          category_id: categoryIds.salary,
          transaction_type: TransactionType.INCOME,
          amount_cents: 1_000_000n,
          transaction_date: transactionDate,
          note: 'Salary',
        },
        {
          user_id: userId,
          category_id: categoryIds.freelance,
          transaction_type: TransactionType.INCOME,
          amount_cents: 200_000n,
          transaction_date: transactionDate,
          note: 'Freelance',
        },
      ],
    });

    await prisma.budget.createMany({
      data: [
        {
          user_id: userId,
          category_id: categoryIds.food,
          budget_amount_cents: 100_000n,
          month,
          year,
        },
        {
          user_id: userId,
          category_id: categoryIds.transport,
          budget_amount_cents: 30_000n,
          month,
          year,
        },
      ],
    });

    monthly = new MonthlyReportService(prisma);
    budgetAnalytics = new BudgetAnalyticsService(prisma);
    insights = new FinancialInsightsService(prisma);
  }, 20000);

  afterAll(async () => {
    if (prisma) {
      try {
        if (userId) {
          await prisma.budget.deleteMany({ where: { user_id: userId } });
          await prisma.transaction.deleteMany({ where: { user_id: userId } });
          await prisma.category.deleteMany({ where: { user_id: userId } });
          await prisma.user.delete({ where: { id: userId } });
        }
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  test('monthly report returns fixture income, expense, and transaction totals', async () => {
    const result = await monthly.getMonthlyReport(userId, month, year);

    expect(result.summary).toEqual({
      income: '1200000',
      expense: '65000',
      netCashFlow: '1135000',
      transactions: 6,
    });
  });

  test('monthly report aggregates expense totals by category', async () => {
    const result = await monthly.getMonthlyReport(userId, month, year);

    expect(
      result.topExpenseCategories.map(({ name, total }) => [name, total]),
    ).toEqual([
      ['Food', '50000'],
      ['Transport', '10000'],
      ['Utilities', '5000'],
    ]);
  });

  test('monthly report aggregates income totals by category', async () => {
    const result = await monthly.getMonthlyReport(userId, month, year);

    expect(
      result.topIncomeCategories.map(({ name, total }) => [name, total]),
    ).toEqual([
      ['Salary', '1000000'],
      ['Freelance', '200000'],
    ]);
  });

  test('budget analysis totals fixture budgets and their matching expenses', async () => {
    const result = await budgetAnalytics.analyzeMonth(userId, month, year);

    expect(result.overall).toEqual({
      budget: '130000',
      spent: '60000',
      remaining: '70000',
      percentageUsed: 46.15,
    });
    expect(
      result.categories.map(({ categoryName, budgetAmount, spentAmount }) => [
        categoryName,
        budgetAmount,
        spentAmount,
      ]),
    ).toEqual([
      ['Food', '100000', '50000'],
      ['Transport', '30000', '10000'],
    ]);
  });

  test('financial insights identify fixture categories and largest transaction', async () => {
    const result = await insights.getInsights(userId, month, year);

    expect(result.summary).toContain('Highest expense category is Food.');
    expect(result.summary).toContain(
      'Lowest expense category is Utilities.',
    );
    expect(result.statistics.largestTransactionAmount).toBe(1_000_000);
  });
});
