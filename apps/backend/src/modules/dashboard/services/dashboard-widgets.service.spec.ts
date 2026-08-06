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
  const summary = { total_assets_cents: '1000' };
  const cashflow = {
    income: 1000,
    expense: 400,
    netCashFlow: 600,
    comparison: { income: 0, expense: 0, netCashFlow: 0 },
  };
  const monthly: MonthlyReportResult = {
    month: 8,
    year: 2026,
    summary: { income: 1000, expense: 400, netCashFlow: 600, transactions: 5 },
    topExpenseCategories: [],
    topIncomeCategories: [],
  };
  const category: CategoryBreakdownItem[] = [
    {
      categoryId: 'c1',
      categoryName: 'Food',
      totalAmount: 500,
      percentage: 50,
      transactionCount: 2,
    },
  ];
  const trend: TrendResult = {
    type: 'monthly',
    data: [{ period: '2026-03', income: 100, expense: 50, netCashFlow: 50 }],
  };
  const budget: BudgetAnalysisResult = {
    month: 8,
    year: 2026,
    overall: { budget: 1000, spent: 400, remaining: 600, percentageUsed: 40 },
    categories: [],
  };

  const summarySvc: Partial<DashboardService> = {
    getSummaryForUser: jest.fn(() => Promise.resolve(summary)),
  };
  const cashflowSvc: Partial<CashflowAnalyticsService> = {
    getAnalytics: jest.fn(() => Promise.resolve(cashflow)),
  };
  const monthlySvc: Partial<MonthlyReportService> = {
    getMonthlyReport: jest.fn(() => Promise.resolve(monthly)),
  };
  const categorySvc: Partial<CategoryBreakdownService> = {
    getBreakdown: jest.fn(() => Promise.resolve({ categories: category })),
  };
  const trendSvc: Partial<CashflowTrendService> = {
    getTrend: jest.fn(() => Promise.resolve(trend)),
  };
  const budgetSvc: Partial<BudgetAnalyticsService> = {
    analyzeMonth: jest.fn(() => Promise.resolve(budget)),
  };

  return {
    summarySvc: summarySvc as unknown as jest.Mocked<DashboardService>,
    cashflowSvc:
      cashflowSvc as unknown as jest.Mocked<CashflowAnalyticsService>,
    monthlySvc: monthlySvc as unknown as jest.Mocked<MonthlyReportService>,
    categorySvc:
      categorySvc as unknown as jest.Mocked<CategoryBreakdownService>,
    trendSvc: trendSvc as unknown as jest.Mocked<CashflowTrendService>,
    budgetSvc: budgetSvc as unknown as jest.Mocked<BudgetAnalyticsService>,
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
    expect(res.trend.length).toBeGreaterThan(0);
    expect(res.budget).toBeDefined();
  });

  it('returns partial dashboard when some widgets fail', async () => {
    const mocks = makeMocks();
    // make cashflow fail
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
    expect(res.cashFlow).toEqual({}); // fallback
    expect(res.monthlyReport).toBeDefined();
  });

  it('returns empty structures when services return empty', async () => {
    const mocks = makeMocks();
    mocks.summarySvc.getSummaryForUser = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as jest.Mocked<DashboardService>['getSummaryForUser'];
    mocks.cashflowSvc.getAnalytics = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as jest.Mocked<CashflowAnalyticsService>['getAnalytics'];
    mocks.monthlySvc.getMonthlyReport = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as jest.Mocked<MonthlyReportService>['getMonthlyReport'];
    mocks.categorySvc.getBreakdown = jest.fn(() =>
      Promise.resolve({ categories: [] }),
    ) as unknown as jest.Mocked<CategoryBreakdownService>['getBreakdown'];
    mocks.trendSvc.getTrend = jest.fn(() =>
      Promise.resolve({ type: 'monthly', data: [] }),
    ) as unknown as jest.Mocked<CashflowTrendService>['getTrend'];
    mocks.budgetSvc.analyzeMonth = jest.fn(() =>
      Promise.resolve(null),
    ) as unknown as jest.Mocked<BudgetAnalyticsService>['analyzeMonth'];

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
    expect(res.trend).toEqual([]);
    expect(res.budget).toEqual({});
  });

  it('continues when a widget throws during processing', async () => {
    const mocks = makeMocks();
    mocks.monthlySvc.getMonthlyReport = jest.fn(() =>
      Promise.reject(new Error('fail monthly')),
    ) as unknown as jest.Mocked<MonthlyReportService>['getMonthlyReport'];
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
