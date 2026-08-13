import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinanceBotService } from './finance-bot.service';

@Injectable()
export class FinanceBotScheduler {
  private readonly logger = new Logger(FinanceBotScheduler.name);
  private running = false;

  constructor(private readonly financeBotService: FinanceBotService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDailyRecordingReminders(): Promise<void> {
    if (this.running) {
      this.logger.warn('FinanceBot scheduler skipped overlapping execution');
      return;
    }

    this.running = true;
    try {
      await this.financeBotService.runDailyRecordingReminders();
    } catch (error) {
      this.logger.error(
        'FinanceBot daily reminder scheduler failed',
        error as Error,
      );
    } finally {
      this.running = false;
    }
  }
}
