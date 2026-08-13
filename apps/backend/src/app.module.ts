import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { SavingGoalsModule } from './modules/saving-goals/saving-goals.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BillsModule } from './modules/bills/bills.module';
import { FinanceBotModule } from './modules/finance-bot/finance-bot.module';
import { AiModule } from './modules/ai/ai.module';

/**
 * Root application module.
 *
 * The global shared layer and future feature modules are wired here.
 */
@Module({
  imports: [
    ConfigModule,
    SharedModule,
    SystemModule,
    UsersModule,
    AuthModule,
    AuditLogsModule,
    DashboardModule,
    ReportsModule,
    AnalyticsModule,
    TransactionsModule,
    AccountsModule,
    CategoriesModule,
    BudgetsModule,
    SavingGoalsModule,
    InvestmentsModule,
    NotificationsModule,
    SettingsModule,
    BillsModule,
    FinanceBotModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
