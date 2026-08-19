/* eslint-disable @typescript-eslint/unbound-method */
import { FinanceBotService } from './finance-bot.service';
import type { NotificationsService } from '../../notifications/services/notifications.service';
import type { UserSettingsService } from '../../settings/services/user-settings.service';
import type { BudgetAnalyticsService } from '../../reports/services/budget-analytics.service';
import type { PrismaService } from '../../../database/prisma.service';

// A permissive/optional version used by mocks: Prisma count args are optional in many calls.
type MaybeTransactionCountArgs = {
  where?: {
    user_id?: string;
    transaction_date?: {
      gte: Date;
      lt?: Date;
    };
  };
};

// Loosely typed prisma delegate mock: tests reassign jest.fn() implementations.
interface PrismaDelegateMocks {
  userSettings: {
    findMany: jest.Mock;
  };
  transaction: {
    count: jest.Mock;
    findFirst: jest.Mock;
  };
}

const makeMocks = () => {
  const notifications = {
    createIfNotExists: jest.fn(async () =>
      Promise.resolve({ id: 'notification-1' }),
    ),
    findByDedupeKey: jest.fn(() => Promise.resolve(null)),
  } as unknown as NotificationsService;

  const prisma: PrismaDelegateMocks = {
    userSettings: {
      findMany: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const userSettings = {
    getSettings: jest.fn(),
  } as unknown as UserSettingsService;

  const budgetAnalytics = {
    analyzeMonth: jest.fn(),
  } as unknown as BudgetAnalyticsService;

  return { notifications, prisma, userSettings, budgetAnalytics };
};

const makeService = (mocks: ReturnType<typeof makeMocks>) =>
  new FinanceBotService(
    mocks.notifications,
    mocks.userSettings,
    mocks.budgetAnalytics,
    mocks.prisma as unknown as PrismaService,
  );

describe('FinanceBotService.runDailyRecordingReminders', () => {
  it('uses English copy when the user settings language is English', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-en',
        language: 'en',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-en',
      'DAILY_RECORDING_REMINDER',
      'Remember to log today\'s spending',
      'Don\'t forget to log today\'s transactions!',
      {
        ruleType: 'DAILY_RECORDING_REMINDER',
        referenceDate: '2026-08-09',
        priority: 'LOW',
      },
      'user-en|DAILY_RECORDING_REMINDER|2026-08-09',
    );
  });

  it('creates a daily reminder when the user has not recorded today', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-1',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-1',
      'DAILY_RECORDING_REMINDER',
      'Ingat catat pengeluaran hari ini',
      'Jangan lupa catat transaksi hari ini ya!',
      {
        ruleType: 'DAILY_RECORDING_REMINDER',
        referenceDate: '2026-08-09',
        priority: 'LOW',
      },
      'user-1|DAILY_RECORDING_REMINDER|2026-08-09',
    );
  });

  it('does not create a reminder when the user has already recorded today', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-2',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(1);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).not.toHaveBeenCalled();
  });

  it('does not create a reminder when Finance Bot is disabled', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-2b',
        notification_preferences: {
          financeBot: {
            enabled: false,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).not.toHaveBeenCalled();
  });

  it('creates escalation only when reminder one exists and the user still has no recording', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-3',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest
      .fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValueOnce({
      id: 'reminder-1',
      user_id: 'user-3',
      created_at: new Date('2026-08-09T11:00:00.000Z'),
    } as any);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T13:00:00Z'));

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-3',
      'DAILY_RECORDING_ESCALATION',
      'Ayo catat sekarang juga!',
      'Masih belum ada transaksi hari ini. Yuk catat biar ga ketinggalan.',
      {
        ruleType: 'DAILY_RECORDING_ESCALATION',
        referenceDate: '2026-08-09',
        priority: 'HIGH',
      },
      'user-3|DAILY_RECORDING_ESCALATION|2026-08-09',
    );
  });

  it('does not escalate when first reminder is absent', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-4',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T13:00:00Z'));

    expect(mocks.notifications.createIfNotExists).not.toHaveBeenCalled();
  });

  it('continues processing other users when one user evaluation fails', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-5',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
      {
        user_id: 'user-6',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);
    mocks.notifications.createIfNotExists = jest
      .fn()
      .mockRejectedValueOnce(new Error('failed-for-user-5'))
      .mockResolvedValueOnce({ id: 'notification-6' });

    const service = makeService(mocks);
    await expect(
      service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z')),
    ).resolves.toBeUndefined();

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledTimes(2);
  });

  it('does not create a reminder when a transaction exists earlier on the same local calendar day', async () => {
    const mocks = makeMocks();
    const intervalCalls: Array<{ gte: Date; lt: Date }> = [];
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-same-day',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn(
      (args?: MaybeTransactionCountArgs) => {
        const td = args?.where?.transaction_date;
        if (td && td.lt) intervalCalls.push({ gte: td.gte, lt: td.lt });
        return 1;
      },
    );
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).not.toHaveBeenCalled();
    expect(intervalCalls[0].gte.toISOString()).toBe('2026-08-08T15:00:00.000Z');
    expect(intervalCalls[0].lt.toISOString()).toBe('2026-08-09T15:00:00.000Z');
  });

  it('creates a reminder when a transaction exists only on the previous local calendar day', async () => {
    const mocks = makeMocks();
    const countInvocations: Array<{ gte: Date; lt: Date }> = [];
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-prev-day',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn(
      (args?: MaybeTransactionCountArgs) => {
        const td = args?.where?.transaction_date;
        if (td && td.lt) countInvocations.push({ gte: td.gte, lt: td.lt });
        return 0;
      },
    );
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledTimes(1);
    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-prev-day',
      'DAILY_RECORDING_REMINDER',
      'Ingat catat pengeluaran hari ini',
      'Jangan lupa catat transaksi hari ini ya!',
      {
        ruleType: 'DAILY_RECORDING_REMINDER',
        referenceDate: '2026-08-09',
        priority: 'LOW',
      },
      'user-prev-day|DAILY_RECORDING_REMINDER|2026-08-09',
    );
    expect(countInvocations[0].gte.toISOString()).toBe(
      '2026-08-08T15:00:00.000Z',
    );
    expect(countInvocations[0].lt.toISOString()).toBe(
      '2026-08-09T15:00:00.000Z',
    );
  });

  it('handles different user timezones independently', async () => {
    const mocks = makeMocks();
    const calls: Record<string, { gte: Date; lt: Date }> = {};
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-ny',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '07:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'America/New_York',
      },
      {
        user_id: 'user-tokyo',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Asia/Tokyo',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn(
      (args?: MaybeTransactionCountArgs) => {
        const userId = args?.where?.user_id ?? 'unknown';
        const td = args?.where?.transaction_date;
        if (td && td.lt) calls[userId] = { gte: td.gte, lt: td.lt };
        return 1;
      },
    );
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(calls['user-ny'].gte.toISOString()).toBe('2026-08-09T04:00:00.000Z');
    expect(calls['user-ny'].lt.toISOString()).toBe('2026-08-10T04:00:00.000Z');
    expect(calls['user-tokyo'].gte.toISOString()).toBe(
      '2026-08-08T15:00:00.000Z',
    );
    expect(calls['user-tokyo'].lt.toISOString()).toBe(
      '2026-08-09T15:00:00.000Z',
    );
  });

  it('handles DST transitions correctly for local calendar day boundaries', async () => {
    const mocks = makeMocks();
    const argsByUser: Record<string, { gte: Date; lt: Date }> = {};
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-berlin',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Europe/Berlin',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn(
      (args?: MaybeTransactionCountArgs) => {
        const td = args?.where?.transaction_date;
        if (td && td.lt) argsByUser['user-berlin'] = { gte: td.gte, lt: td.lt };
        return 1;
      },
    );
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-03-29T12:00:00Z'));

    expect(argsByUser['user-berlin'].gte.toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
    expect(argsByUser['user-berlin'].lt.toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });

  it('uses stable pagination ordering when fetching user settings pages', async () => {
    const mocks = makeMocks();
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      user_id: `user-${i}`,
      notification_preferences: {
        financeBot: {
          enabled: false,
          dailyReminderEnabled: true,
        },
      },
      timezone: 'UTC',
    }));
    mocks.prisma.userSettings.findMany = jest
      .fn()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce([]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T11:00:00Z'));

    expect(mocks.prisma.userSettings.findMany).toHaveBeenNthCalledWith(1, {
      skip: 0,
      take: 100,
      orderBy: { user_id: 'asc' },
    });
    expect(mocks.prisma.userSettings.findMany).toHaveBeenNthCalledWith(2, {
      skip: 100,
      take: 100,
      orderBy: { user_id: 'asc' },
    });
  });

  it('falls back to UTC when a user timezone is invalid', async () => {
    const mocks = makeMocks();
    const recordedIntervals: Array<{ gte: Date; lt: Date }> = [];
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-invalid-timezone',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '20:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'Invalid/Zone',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn(
      (args?: MaybeTransactionCountArgs) => {
        const td = args?.where?.transaction_date;
        if (td && td.lt) recordedIntervals.push({ gte: td.gte, lt: td.lt });
        return 0;
      },
    );
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T20:00:00Z'));

    expect(recordedIntervals[0].gte.toISOString()).toBe(
      '2026-08-09T00:00:00.000Z',
    );
    expect(recordedIntervals[0].lt.toISOString()).toBe(
      '2026-08-10T00:00:00.000Z',
    );
    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-invalid-timezone',
      'DAILY_RECORDING_REMINDER',
      'Ingat catat pengeluaran hari ini',
      'Jangan lupa catat transaksi hari ini ya!',
      {
        ruleType: 'DAILY_RECORDING_REMINDER',
        referenceDate: '2026-08-09',
        priority: 'LOW',
      },
      'user-invalid-timezone|DAILY_RECORDING_REMINDER|2026-08-09',
    );
  });

  it('falls back to default reminder time when the configured time is invalid', async () => {
    const mocks = makeMocks();
    mocks.prisma.userSettings.findMany = jest.fn().mockResolvedValue([
      {
        user_id: 'user-invalid-reminder-time',
        notification_preferences: {
          financeBot: {
            enabled: true,
            dailyReminderEnabled: true,
            reminderTime1: '25:00',
            reminderTime2: '22:00',
          },
        },
        timezone: 'UTC',
      },
    ]);
    mocks.prisma.transaction.count = jest.fn().mockResolvedValue(0);
    mocks.notifications.findByDedupeKey = jest.fn().mockResolvedValue(null);

    const service = makeService(mocks);
    await service.runDailyRecordingReminders(new Date('2026-08-09T20:00:00Z'));

    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledTimes(1);
    expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
      'user-invalid-reminder-time',
      'DAILY_RECORDING_REMINDER',
      'Ingat catat pengeluaran hari ini',
      'Jangan lupa catat transaksi hari ini ya!',
      {
        ruleType: 'DAILY_RECORDING_REMINDER',
        referenceDate: '2026-08-09',
        priority: 'LOW',
      },
      'user-invalid-reminder-time|DAILY_RECORDING_REMINDER|2026-08-09',
    );
  });

  describe('FinanceBotService.evaluateOnTransaction', () => {
    it('skips evaluation when finance bot is disabled', async () => {
      const mocks = makeMocks();
      mocks.userSettings.getSettings = jest.fn().mockResolvedValue({
        notification_preferences: {
          financeBot: {
            enabled: false,
          },
        },
      });
      const service = makeService(mocks);

      await expect(
        service.evaluateOnTransaction('user-1', {
          transaction_date: new Date('2026-08-09T12:00:00Z'),
          category_id: 'c1',
        }),
      ).resolves.toBeUndefined();

      expect(mocks.notifications.createIfNotExists).not.toHaveBeenCalled();
      expect(mocks.prisma.transaction.findFirst).not.toHaveBeenCalled();
    });

    it('creates a budget threshold notification when configured threshold is met', async () => {
      const mocks = makeMocks();
      mocks.userSettings.getSettings = jest.fn().mockResolvedValue({
        notification_preferences: {
          financeBot: {
            enabled: true,
            budgetThreshold: 80,
          },
        },
      });
      mocks.budgetAnalytics.analyzeMonth = jest.fn().mockResolvedValue({
        categories: [
          {
            categoryId: 'c1',
            categoryName: 'Food',
            percentageUsed: 85,
          },
        ],
      });
      mocks.prisma.transaction.findFirst = jest.fn().mockResolvedValue(null);

      const service = makeService(mocks);
      await service.evaluateOnTransaction('user-1', {
        transaction_date: '2026-08-09T12:00:00Z',
        category_id: 'c1',
      });

      expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
        'user-1',
        'BUDGET_THRESHOLD',
        'Anggaran hampir penuh',
        'Budget Food kamu sudah 85%.',
        {
          ruleType: 'BUDGET_THRESHOLD',
          budgetId: 'c1',
          period: '2026-08',
          threshold: 80,
          percentage: 85,
          priority: 'MEDIUM',
        },
        'user-1|BUDGET_THRESHOLD|c1|2026-08|80',
      );
    });

    it('handles notification failures during transaction evaluation without throwing', async () => {
      const mocks = makeMocks();
      mocks.userSettings.getSettings = jest.fn().mockResolvedValue({
        notification_preferences: {
          financeBot: {
            enabled: true,
            budgetThreshold: 80,
          },
        },
      });
      mocks.budgetAnalytics.analyzeMonth = jest.fn().mockResolvedValue({
        categories: [
          {
            categoryId: 'c1',
            categoryName: 'Food',
            percentageUsed: 85,
          },
        ],
      });
      mocks.notifications.createIfNotExists = jest
        .fn()
        .mockRejectedValue(new Error('notification failure'));
      mocks.prisma.transaction.findFirst = jest.fn().mockResolvedValue(null);

      const service = makeService(mocks);
      await expect(
        service.evaluateOnTransaction('user-1', {
          transaction_date: '2026-08-09T12:00:00Z',
          category_id: 'c1',
        }),
      ).resolves.toBeUndefined();
    });

    it('creates a recording recovery notification after a gap in transactions', async () => {
      const mocks = makeMocks();
      mocks.userSettings.getSettings = jest.fn().mockResolvedValue({
        notification_preferences: {
          financeBot: {
            enabled: true,
          },
        },
      });
      mocks.budgetAnalytics.analyzeMonth = jest.fn().mockResolvedValue({
        categories: [],
      });
      mocks.prisma.transaction.findFirst = jest.fn().mockResolvedValue({
        transaction_date: '2026-08-07T10:00:00.000Z',
      });

      const service = makeService(mocks);
      await service.evaluateOnTransaction('user-1', {
        transaction_date: '2026-08-09T12:00:00Z',
        category_id: 'c2',
      });

      expect(mocks.notifications.createIfNotExists).toHaveBeenCalledWith(
        'user-1',
        'RECORDING_RECOVERY',
        'Selamat! Kembali mencatat',
        'Akhirnya nyatet lagi — lanjutkan ya! (streak sebelumnya: 2 hari)',
        {
          ruleType: 'RECORDING_RECOVERY',
          streakDays: 2,
          previousDate: '2026-08-07T10:00:00.000Z',
          priority: 'LOW',
        },
        'user-1|RECORDING_RECOVERY|2026-08-09',
      );
    });
  });
});
