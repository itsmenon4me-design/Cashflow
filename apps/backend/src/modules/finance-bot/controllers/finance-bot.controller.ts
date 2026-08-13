import { Controller, Post, Query, BadRequestException } from '@nestjs/common';
import { FinanceBotService } from '../services/finance-bot.service';

@Controller('internal/finance-bot')
export class FinanceBotController {
  constructor(private readonly service: FinanceBotService) {}

  // Development-only hook to run the daily reminders pass at an arbitrary reference time
  @Post('run-daily')
  async runDaily(@Query('time') time?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not allowed in production');
    }
    const ref = time ? new Date(time) : new Date();
    if (isNaN(ref.getTime())) throw new BadRequestException('Invalid time');
    await this.service.runDailyRecordingReminders(ref);
    return { status: 'ok', runAt: ref.toISOString() };
  }
}
