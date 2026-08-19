import { Injectable, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  CashflowAnalyticsService,
  AnalyticsResult,
} from './cashflow-analytics.service';
import {
  MonthlyReportService,
  MonthlyReportResult,
} from '../../reports/services/monthly-report.service';
import { CategoryBreakdownService } from '../../reports/services/category-breakdown.service';
import {
  CashflowTrendService,
  TrendResult,
} from '../../reports/services/cashflow-trend.service';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import {
  BudgetAnalyticsService,
  BudgetAnalysisResult,
} from '../../reports/services/budget-analytics.service';

type CategoryWidgetItem = {
  categoryId: string;
  categoryName: string;
  totalAmount: string;
  percentage: number;
  transactionCount: number;
};

@Injectable()
export class DashboardWidgetsService {
  private readonly logger = new Logger(DashboardWidgetsService.name);

  constructor(
    private readonly summarySvc: DashboardService,
    private readonly cashflowSvc: CashflowAnalyticsService,
    private readonly monthlySvc: MonthlyReportService,
    private readonly categorySvc: CategoryBreakdownService,
    private readonly trendSvc: CashflowTrendService,
    private readonly budgetSvc: BudgetAnalyticsService,
  ) {}

  private safeCall = async <T>(
    fn: () => Promise<T>,
    widgetName: string,
    fallback: T,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(`Widget ${widgetName} failed: ${String(err)}`);
      return fallback;
    }
  };

  async getWidgets(userId: string, month?: number, year?: number, currency?: string) {
    // Determine month/year defaults
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    // Summary
    const summary = await this.safeCall<DashboardSummaryResponseDto | null>(
      () => this.summarySvc.getSummaryForUser(userId, currency),
      'summary',
      null,
    );

    // Cashflow analytics for the month
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
    const cashFlow = await this.safeCall<AnalyticsResult | null>(
      () => this.cashflowSvc.getAnalytics(userId, monthStart, monthEnd, currency),
      'cashflow',
      null,
    );

    // Monthly report (full summary)
    const monthlyReport = await this.safeCall<MonthlyReportResult | null>(
      async () => this.monthlySvc.getMonthlyReport(userId, m, y, undefined, currency),
      'monthlyReport',
      null,
    );

    // Category breakdown (top 5 expenses)
    const categoryBreakdown = await this.safeCall<CategoryWidgetItem[]>(
      async () => {
        const res = await this.categorySvc.getBreakdown(
          userId,
          'expense',
          m,
          y,
          undefined,
          currency,
        );
        return (res.categories?.slice(0, 5) ?? []) as CategoryWidgetItem[];
      },
      'categoryBreakdown',
      [],
    );

    // Trend: last 6 months monthly trend ending at month/year
    const end = monthEnd;
    const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
    const trend = await this.safeCall<TrendResult | null>(
      () => this.trendSvc.getTrend(userId, 'monthly', start, end, currency),
      'trend',
      null,
    );

    // Budget overview
    const budget = await this.safeCall<BudgetAnalysisResult | null>(
      () => this.budgetSvc.analyzeMonth(userId, m, y, currency),
      'budget',
      null,
    );

    return {
      summary: summary ?? {},
      cashFlow: cashFlow ?? {},
      monthlyReport: monthlyReport ?? {},
      categoryBreakdown: categoryBreakdown ?? [],
      trend:
        trend && trend.data ? { type: trend.type, data: trend.data } : null,
      budget: budget ?? {},
    } as const;
  }
}
