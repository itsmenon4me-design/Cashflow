import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { PrismaDashboardRepository } from './repositories/prisma-dashboard.repository';
import { AnalyticsController } from './controllers/analytics.controller';
import { CashflowAnalyticsService } from './services/cashflow-analytics.service';
import { ReportsModule } from '../reports/reports.module';
import { DashboardWidgetsController } from './controllers/dashboard-widgets.controller';
import { DashboardWidgetsService } from './services/dashboard-widgets.service';

@Module({
  imports: [ReportsModule],
  controllers: [
    DashboardController,
    AnalyticsController,
    DashboardWidgetsController,
  ],
  providers: [
    DashboardService,
    PrismaDashboardRepository,
    CashflowAnalyticsService,
    DashboardWidgetsService,
  ],
  exports: [
    DashboardService,
    CashflowAnalyticsService,
    DashboardWidgetsService,
  ],
})
export class DashboardModule {}
