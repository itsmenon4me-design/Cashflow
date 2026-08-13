import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FinanceBotService } from './services/finance-bot.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { ReportsModule } from '../reports/reports.module';
import { FinanceBotController } from './controllers/finance-bot.controller';
import { FinanceBotScheduler } from './services/finance-bot.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
    SettingsModule,
    BudgetsModule,
    ReportsModule,
  ],
  providers: [FinanceBotService, FinanceBotScheduler],
  controllers: [FinanceBotController],
  exports: [FinanceBotService],
})
export class FinanceBotModule {}
