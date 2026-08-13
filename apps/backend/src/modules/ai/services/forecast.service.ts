import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { ForecastResponseDto } from '../dto/forecast-response.dto';
import {
  DEFAULT_FORECAST_HORIZON,
  MAX_FORECAST_HORIZON,
} from '../dto/forecast-query.dto';
import { ForecastEngine } from '../engines/forecast.engine';
import { getCurrencySpec } from '../../../common/types/money';
import { ErrorService } from '../../../common/errors/error.service';
import { ErrorCode } from '../../../common/errors/error-codes';

export interface ForecastOptions {
  horizon?: number;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class ForecastService {
  public clock: () => Date = () => new Date();
  private readonly engine = new ForecastEngine();

  constructor(private readonly prisma: PrismaService) {}

  async forecast(
    userId: string,
    options?: ForecastOptions,
  ): Promise<ForecastResponseDto> {
    const rawHorizon = options?.horizon;
    const horizon = Number.isFinite(rawHorizon)
      ? Math.min(
          MAX_FORECAST_HORIZON,
          Math.max(1, Math.floor(rawHorizon as number)),
        )
      : DEFAULT_FORECAST_HORIZON;

    const timezone = await this.resolveTimeZone(userId);
    const now = this.clock();
    const window = this.engine.buildHistoryWindow(now, timezone, options);

    // Resolve target currency (primary/default account currency) to avoid mixing multi-currency amounts
    const accounts = await this.prisma.account.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { currency: true, is_default: true },
    });
    const defaultAcc = accounts.find((a) => a.is_default);
    const targetCurrency =
      defaultAcc?.currency ?? accounts[0]?.currency ?? 'IDR';
    try {
      getCurrencySpec(targetCurrency);
    } catch {
      throw ErrorService.create(
        ErrorCode.INVALID_INPUT,
        `Forecast does not support currency ${targetCurrency}`,
      );
    }

    const recs =
      window.months.length === 0
        ? []
        : await this.prisma.transaction.findMany({
            where: {
              user_id: userId,
              deleted_at: null,
              transfer_group_id: null,
              account: { currency: targetCurrency },
              transaction_date: { gte: window.startUtc, lt: window.endUtc },
            },
            select: {
              transaction_date: true,
              transaction_type: true,
              amount_cents: true,
              transfer_group_id: true,
            },
          });

    const result = await this.engine.forecast({
      transactions: recs.map((r) => ({
        transactionDate: new Date(r.transaction_date),
        transactionType:
          r.transaction_type === TransactionType.INCOME ? 'INCOME' : 'EXPENSE',
        amountCents: r.amount_cents ?? 0n,
        transferGroupId: r.transfer_group_id,
      })),
      window,
      horizon,
      now,
      timezone,
      loadCurrentBalance: () => this.loadCurrentBalance(userId, targetCurrency),
    });
    return { ...result, currency: targetCurrency };
  }

  private async resolveTimeZone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: userId },
      select: { timezone: true },
    });
    const candidates = [
      settings?.timezone,
      process.env.APP_DEFAULT_TIMEZONE,
      'UTC',
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);
    for (const tz of candidates) {
      if (this.isValidTimeZone(tz)) return tz;
    }
    return 'UTC';
  }

  private isValidTimeZone(tz: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  private async loadCurrentBalance(
    userId: string,
    currency: string,
  ): Promise<bigint> {
    const agg = await this.prisma.account.aggregate({
      where: { user_id: userId, deleted_at: null, currency },
      _sum: { current_balance_cents: true },
    });
    return agg._sum.current_balance_cents ?? 0n;
  }
}
