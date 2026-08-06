import { Module } from '@nestjs/common';
import { MonthlyReportService } from './services/monthly-report.service';
import { ReportsController } from './controllers/reports.controller';
import { CategoryBreakdownService } from './services/category-breakdown.service';
import { CashflowTrendService } from './services/cashflow-trend.service';
import { BudgetAnalyticsService } from './services/budget-analytics.service';
import { ReportExportService } from './services/report-export.service';
import { FinancialInsightsService } from './services/financial-insights.service';

@Module({
  controllers: [ReportsController],
  providers: [
    MonthlyReportService,
    CategoryBreakdownService,
    CashflowTrendService,
    BudgetAnalyticsService,
    ReportExportService,
    FinancialInsightsService,
  ],
  exports: [
    MonthlyReportService,
    CategoryBreakdownService,
    CashflowTrendService,
    BudgetAnalyticsService,
    ReportExportService,
    FinancialInsightsService,
  ],
})
export class ReportsModule {}
