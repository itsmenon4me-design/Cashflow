/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UserSettingsService } from '../../settings/services/user-settings.service';
import { BudgetAnalyticsService } from '../../reports/services/budget-analytics.service';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

@Injectable()
export class FinanceBotService {
  private readonly logger = new Logger(FinanceBotService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly settings: UserSettingsService,
    private readonly budgetAnalytics: BudgetAnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Evaluate rules after a transaction is created.
   * This must not affect transaction success; errors are logged and swallowed.
   */
  async evaluateOnTransaction(userId: string, transaction: any): Promise<void> {
    try {
      const settings = await this.settings.getSettings(userId);
      const prefs = (settings.notification_preferences ?? {}) as any;
      const financeBot = prefs.financeBot ?? {};
      if (!financeBot.enabled) return;

      // Budget threshold evaluation
      try {
        const txDate = transaction.transaction_date
          ? new Date(transaction.transaction_date)
          : new Date();
        const month = txDate.getUTCMonth() + 1;
        const year = txDate.getUTCFullYear();

        const analysis = await this.budgetAnalytics.analyzeMonth(
          userId,
          month,
          year,
        );

        const categoryId = transaction.category_id;
        const item = analysis.categories.find(
          (c) => c.categoryId === categoryId,
        );
        if (item) {
          const threshold = Number(financeBot.budgetThreshold ?? 80);
          const percentage = Math.round(item.percentageUsed);

          // Threshold notification (>= configured threshold but < 100)
          if (percentage >= threshold && percentage < 100) {
            const period = `${year}-${String(month).padStart(2, '0')}`;
            const dedupe = `${userId}|BUDGET_THRESHOLD|${categoryId}|${period}|${threshold}`;
            const title = `Anggaran hampir penuh`;
            const message = `Budget ${item.categoryName ?? ''} kamu sudah ${percentage}%.`;
            await this.notifications.createIfNotExists(
              userId,
              'BUDGET_THRESHOLD',
              title,
              message,
              {
                ruleType: 'BUDGET_THRESHOLD',
                budgetId: categoryId,
                period,
                threshold,
                percentage,
                priority: 'MEDIUM',
              },
              dedupe,
            );
          }

          // Exceeded notification (>=100)
          if (percentage >= 100) {
            const period = `${year}-${String(month).padStart(2, '0')}`;
            const dedupe = `${userId}|BUDGET_EXCEEDED|${categoryId}|${period}|100`;
            const title = `Anggaran terlewati`;
            const message = `Budget ${item.categoryName ?? ''} sudah terlewati (${percentage}%).`;
            await this.notifications.createIfNotExists(
              userId,
              'BUDGET_EXCEEDED',
              title,
              message,
              {
                ruleType: 'BUDGET_EXCEEDED',
                budgetId: categoryId,
                period,
                percentage,
                priority: 'HIGH',
              },
              dedupe,
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Budget evaluation failed for user=${userId} ${err}`);
      }

      // Recording recovery evaluation
      try {
        // Find most recent transaction before this one
        const prev = await this.prisma.transaction.findFirst({
          where: {
            user_id: userId,
            deleted_at: null,
            transaction_date: {
              lt: transaction.transaction_date ?? new Date(),
            },
          },
          orderBy: { transaction_date: 'desc' },
        });

        if (!prev) {
          // No previous transaction -> cannot compute recovery
        } else {
          const prevDate = new Date(prev.transaction_date);
          const curDate = new Date(transaction.transaction_date ?? new Date());
          const diffDays = Math.floor(
            (Date.UTC(
              curDate.getUTCFullYear(),
              curDate.getUTCMonth(),
              curDate.getUTCDate(),
            ) -
              Date.UTC(
                prevDate.getUTCFullYear(),
                prevDate.getUTCMonth(),
                prevDate.getUTCDate(),
              )) /
              (1000 * 60 * 60 * 24),
          );

          if (diffDays >= 1) {
            const dedupe = `${userId}|RECORDING_RECOVERY|${curDate.toISOString().slice(0, 10)}`;
            const title = `Selamat! Kembali mencatat`;
            const message = `Akhirnya nyatet lagi — lanjutkan ya! (streak sebelumnya: ${diffDays} hari)`;
            await this.notifications.createIfNotExists(
              userId,
              'RECORDING_RECOVERY',
              title,
              message,
              {
                ruleType: 'RECORDING_RECOVERY',
                streakDays: diffDays,
                previousDate: prev.transaction_date,
                priority: 'LOW',
              },
              dedupe,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `Recovery evaluation failed for user=${userId} ${err}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `FinanceBot evaluateOnTransaction failed user=${userId} ${(error as Error).message}`,
      );
    }
  }

  /**
   * Run daily reminder pass. This is intentionally callable for testing.
   * referenceTime should be in UTC.
   */
  private formatInTimeZone(date: Date, tz: string): string {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);

    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    }

    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
  }

  private getLocalDateInTimeZone(date: Date, tz: string): string {
    return this.formatInTimeZone(date, tz).slice(0, 10);
  }

  private isValidTimeZone(value: unknown): value is string {
    if (typeof value !== 'string' || value.length === 0) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  private resolveTimeZone(raw?: string | null): string {
    const candidates = [
      raw,
      process.env.TZ,
      process.env.APP_DEFAULT_TIMEZONE,
      'UTC',
    ] as const;

    for (const candidate of candidates) {
      if (this.isValidTimeZone(candidate)) return candidate;
    }

    return 'UTC';
  }

  private isValidReminderTime(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private normalizeReminderTime(time: unknown, defaultTime: string): string {
    if (this.isValidReminderTime(time)) return time;
    return defaultTime;
  }

  private getUtcInstantForLocalDateTime(
    localDate: string,
    localTime: string,
    tz: string,
  ): Date {
    const [year, month, day] = localDate.split('-').map(Number);
    const target = `${localDate} ${localTime}`;
    const approx = Date.UTC(year, month - 1, day, 0, 0, 0);
    let low = approx - 24 * 60 * 60 * 1000;
    let high = approx + 24 * 60 * 60 * 1000;

    while (high - low > 1000) {
      const mid = Math.floor((low + high) / 2);
      const current = this.formatInTimeZone(new Date(mid), tz);
      if (current < target) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const roundedLow = Math.ceil(low / 1000) * 1000;
    const roundedHigh = Math.floor(high / 1000) * 1000;
    for (let ts = roundedLow; ts <= roundedHigh; ts += 1000) {
      if (this.formatInTimeZone(new Date(ts), tz) === target) {
        return new Date(ts);
      }
    }

    throw new Error(
      `Unable to resolve local datetime ${target} for timezone ${tz}`,
    );
  }

  private getLocalDayBounds(referenceTime: Date, tz: string) {
    const localDate = this.getLocalDateInTimeZone(referenceTime, tz);
    const start = this.getUtcInstantForLocalDateTime(localDate, '00:00:00', tz);
    const [year, month, day] = localDate.split('-').map(Number);
    const nextLocalDate = new Date(Date.UTC(year, month - 1, day + 1));
    const nextLocalDateString = `${nextLocalDate.getUTCFullYear()}-${String(
      nextLocalDate.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(nextLocalDate.getUTCDate()).padStart(2, '0')}`;
    const end = this.getUtcInstantForLocalDateTime(
      nextLocalDateString,
      '00:00:00',
      tz,
    );
    return { localDate, start, end };
  }

  async runDailyRecordingReminders(
    referenceTime: Date = new Date(),
  ): Promise<void> {
    const take = 100;
    let skip = 0;
    while (true) {
      const settingsRows = await this.prisma.userSettings.findMany({
        skip,
        take,
        orderBy: { user_id: 'asc' },
      });
      if (!settingsRows || settingsRows.length === 0) break;

      for (const s of settingsRows) {
        try {
          const userId = s.user_id;
          const prefs = (s.notification_preferences ?? {}) as any;
          const financeBot = prefs.financeBot ?? {};
          if (!financeBot.enabled || !financeBot.dailyReminderEnabled) continue;

          const tz = this.resolveTimeZone(s.timezone ?? null);

          // get local time string 'HH:MM'
          const local = new Date(referenceTime).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: tz,
          });
          const localTime = local.replace('\u200E', '').trim();

          const rem1 = this.normalizeReminderTime(
            financeBot.reminderTime1 ?? '20:00',
            '20:00',
          );
          const rem2 = this.normalizeReminderTime(
            financeBot.reminderTime2 ?? '22:00',
            '22:00',
          );

          const {
            localDate: localDateParts,
            start: localDayStart,
            end: localDayEnd,
          } = this.getLocalDayBounds(referenceTime, tz);
          const recentCount = await this.prisma.transaction.count({
            where: {
              user_id: userId,
              deleted_at: null,
              transaction_date: {
                gte: localDayStart,
                lt: localDayEnd,
              },
            },
          });

          if (localTime === rem1) {
            if (recentCount === 0) {
              const dedupe = `${userId}|DAILY_RECORDING_REMINDER|${localDateParts}`;
              await this.notifications.createIfNotExists(
                userId,
                'DAILY_RECORDING_REMINDER',
                'Ingat catat pengeluaran hari ini',
                'Jangan lupa catat transaksi hari ini ya!',
                {
                  ruleType: 'DAILY_RECORDING_REMINDER',
                  referenceDate: localDateParts,
                  priority: 'LOW',
                },
                dedupe,
              );
            }
          }

          if (localTime === rem2) {
            if (recentCount === 0) {
              // was there a reminder1 today?
              const dedupe1 = `${userId}|DAILY_RECORDING_REMINDER|${localDateParts}`;
              const rem1Notification = await this.notifications.findByDedupeKey(
                userId,
                dedupe1,
              );
              let txSinceRem1 = 0;
              if (rem1Notification?.created_at) {
                const rem1Created = new Date(rem1Notification.created_at);
                txSinceRem1 = await this.prisma.transaction.count({
                  where: {
                    user_id: userId,
                    deleted_at: null,
                    transaction_date: { gte: rem1Created },
                  },
                });
              }

              if (rem1Notification && txSinceRem1 === 0) {
                const dedupe = `${userId}|DAILY_RECORDING_ESCALATION|${localDateParts}`;
                await this.notifications.createIfNotExists(
                  userId,
                  'DAILY_RECORDING_ESCALATION',
                  'Ayo catat sekarang juga!',
                  'Masih belum ada transaksi hari ini. Yuk catat biar ga ketinggalan.',
                  {
                    ruleType: 'DAILY_RECORDING_ESCALATION',
                    referenceDate: localDateParts,
                    priority: 'HIGH',
                  },
                  dedupe,
                );
              }
            }
          }
        } catch (err) {
          this.logger.warn(`FinanceBot per-user evaluation failed ${err}`);
          continue;
        }
      }

      if (settingsRows.length < take) break;
      skip += take;
    }
  }
}
