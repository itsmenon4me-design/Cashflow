import { DashboardWidgetsService } from './dashboard-widgets.service';
import type { DashboardService } from './dashboard.service';
import type { CashflowAnalyticsService } from './cashflow-analytics.service';
import type {
  MonthlyReportService,
  MonthlyReportResult,
} from '../../reports/services/monthly-report.service';
import type {
  CategoryBreakdownService,
  CategoryBreakdownItem,
} from '../../reports/services/category-breakdown.service';
import type {
  CashflowTrendService,
  TrendResult,
} from '../../reports/services/cashflow-trend.service';
import type {
  BudgetAnalyticsService,
  BudgetAnalysisResult,
} from '../../reports/services/budget-analytics.service';

const makeMocks = () => {
  const summary = {
    total_assets_cents: '1000',
    total_income_cents: '120000',
    total_expense_cents: '80000',
    net_cash_flow_cents: '40000',
    total_accounts: 3,
    total_budgets: 2,
    total_categories: 5,
    total_transactions: 20,
    last_updated_at: new Date(),
  };

  const cashflow = {
    income: 1000,
    expense: 400,
    netCashFlow: 600,
    comparison: { income: 0, expense: 0, netCashFlow: 0 },
  };

  const monthly: MonthlyReportResult = {
    month: 8,
    year: 2026,
    summary: {
      income: '1000',
      expense: '400',
      netCashFlow: '600',
      transactions: 5,
    },
    topExpenseCategories: [],
    topIncomeCategories: [],
  };

  const category: CategoryBreakdownItem[] = [
    {
      categoryId: 'c1',
      categoryName: 'Food',
      totalAmount: '500',
      percentage: 50,
      transactionCount: 2,
    },
  ];

  const categoryResult = {
    type: 'expense' as const,
    total: '500',
    categories: category,
  };

  const trend: TrendResult = {
    type: 'monthly',
    data: [
      {
        period: '2026-03',
        income: '100',
        expense: '50',
        netCashFlow: '50',
      },
    ],
  };

  const budget: BudgetAnalysisResult = {
    month: 8,
    year: 2026,
    overall: {
      budget: '1000',
      spent: '400',
      remaining: '600',
      percentageUsed: 40,
    },
    categories: [],
  };

  const summarySvc = {
    getSummaryForUser: jest.fn(() => Promise.resolve(summary)),
  } as unknown as DashboardService;

  const cashflowSvc = {
    getAnalytics: jest.fn(() => Promise.resolve(cashflow)),
  } as unknown as CashflowAnalyticsService;

  const monthlySvc = {
    getMonthlyReport: jest.fn(() => Promise.resolve(monthly)),
  } as unknown as MonthlyReportService;

  const categorySvc = {
    getBreakdown: jest.fn(() => Promise.resolve(categoryResult)),
  } as unknown as CategoryBreakdownService;

  const trendSvc = {
    getTrend: jest.fn(() => Promise.resolve(trend)),
  } as unknown as CashflowTrendService;

  const budgetSvc = {
    analyzeMonth: jest.fn(() => Promise.resolve(budget)),
  } as unknown as BudgetAnalyticsService;

  return {
    summarySvc,
    cashflowSvc,
    monthlySvc,
    categorySvc,
    trendSvc,
    budgetSvc,
  };
};

describe('DashboardWidgetsService', () => {
  it('returns full dashboard when all widgets present', async () => {
    const mocks = makeMocks();

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1', 8, 2026);

    expect(res.summary).toBeDefined();
    expect(res.cashFlow).toBeDefined();
    expect(res.monthlyReport).toBeDefined();
    expect(res.categoryBreakdown.length).toBeGreaterThan(0);
    expect(res.trend?.type).toBe('monthly');
    expect(res.trend?.data.length).toBeGreaterThan(0);
    expect(res.budget).toBeDefined();
  });

  it('wraps trend as { type, data } to match the frontend contract', async () => {
    const mocks = makeMocks();

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1', 8, 2026);

    expect(res.trend).toEqual({
      type: 'monthly',
      data: [
        {
          period: '2026-03',
          income: '100',
          expense: '50',
          netCashFlow: '50',
        },
      ],
    });
  });

  it('returns null trend when the trend service fails', async () => {
    const mocks = makeMocks();

    mocks.trendSvc.getTrend = jest.fn(() =>
      Promise.reject(new Error('trend boom')),
    );

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1', 8, 2026);

    expect(res.trend).toBeNull();
    expect(res.summary).toBeDefined();
  });

  it('returns partial dashboard when some widgets fail', async () => {
    const mocks = makeMocks();

    mocks.cashflowSvc.getAnalytics = jest.fn(() =>
      Promise.reject(new Error('boom')),
    );

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1', 8, 2026);

    expect(res.summary).toBeDefined();
    expect(res.cashFlow).toEqual({});
    expect(res.monthlyReport).toBeDefined();
  });

  it('returns empty structures when services return empty', async () => {
    const mocks = makeMocks();

    mocks.summarySvc.getSummaryForUser = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as typeof mocks.summarySvc.getSummaryForUser;

    mocks.cashflowSvc.getAnalytics = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as typeof mocks.cashflowSvc.getAnalytics;

    mocks.monthlySvc.getMonthlyReport = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as typeof mocks.monthlySvc.getMonthlyReport;

    mocks.categorySvc.getBreakdown = jest.fn(() =>
      Promise.resolve({
        type: 'expense' as const,
        total: '0',
        categories: [],
      }),
    );

    mocks.trendSvc.getTrend = jest.fn(() =>
      Promise.resolve({
        type: 'monthly' as const,
        data: [],
      }),
    );

    mocks.budgetSvc.analyzeMonth = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as typeof mocks.budgetSvc.analyzeMonth;

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1');

    expect(res.summary).toEqual({});
    expect(res.cashFlow).toEqual({});
    expect(res.monthlyReport).toEqual({});
    expect(res.categoryBreakdown).toEqual([]);
    expect(res.trend).toEqual({ type: 'monthly', data: [] });
    expect(res.budget).toEqual({});
  });

  it('continues when a widget throws during processing', async () => {
    const mocks = makeMocks();

    mocks.monthlySvc.getMonthlyReport = jest.fn(() =>
      Promise.reject(new Error('fail monthly')),
    );

    const svc = new DashboardWidgetsService(
      mocks.summarySvc,
      mocks.cashflowSvc,
      mocks.monthlySvc,
      mocks.categorySvc,
      mocks.trendSvc,
      mocks.budgetSvc,
    );

    const res = await svc.getWidgets('user-1', 8, 2026);

    expect(res.summary).toBeDefined();
    expect(res.monthlyReport).toEqual({});
    expect(res.cashFlow).toBeDefined();
  });
});
