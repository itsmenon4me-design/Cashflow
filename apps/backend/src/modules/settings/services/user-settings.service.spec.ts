import { UserSettingsService } from './user-settings.service';
import type { PrismaUserSettingsRepository } from '../repositories/prisma-user-settings.repository';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let repositoryMock: {
    findByUserId: jest.Mock;
    updateByUserId: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    repositoryMock = {
      findByUserId: jest.fn(),
      updateByUserId: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
    };

    service = new UserSettingsService(
      repositoryMock as unknown as PrismaUserSettingsRepository,
    );
  });

  it('preserves nested financeBot settings when loading existing preferences', async () => {
    const existing = {
      id: 'settings-1',
      user_id: 'user-1',
      theme: 'dark',
      language: 'id',
      currency: 'IDR',
      timezone: 'UTC',
      notification_preferences: {
        system: true,
        budgets: false,
        accounts: true,
        financeBot: {
          enabled: true,
          dailyReminderEnabled: true,
          reminderTime1: '20:00',
        },
      },
      created_at: new Date('2026-08-01T00:00:00Z'),
      updated_at: new Date('2026-08-01T00:00:00Z'),
    };

    repositoryMock.findByUserId.mockResolvedValue(existing);

    const result = await service.getSettings('user-1');

    expect(result.notification_preferences).toMatchObject({
      system: true,
      budgets: false,
      accounts: true,
      financeBot: {
        enabled: true,
        dailyReminderEnabled: true,
        reminderTime1: '20:00',
      },
    });
    expect(repositoryMock.updateByUserId).toHaveBeenCalledWith('user-1', {
      notification_preferences: {
        system: true,
        budgets: false,
        accounts: true,
        investments: true,
        savingGoals: true,
        transactions: true,
        financeBot: {
          enabled: true,
          dailyReminderEnabled: true,
          reminderTime1: '20:00',
        },
      },
    });
  });

  it('strips invalid financeBot reminder times when normalizing settings', async () => {
    const existing = {
      id: 'settings-2',
      user_id: 'user-2',
      theme: 'dark',
      language: 'id',
      currency: 'IDR',
      timezone: 'UTC',
      notification_preferences: {
        system: true,
        financeBot: {
          enabled: true,
          reminderTime1: '25:00',
          reminderTime2: '22:00',
        },
      },
      created_at: new Date('2026-08-01T00:00:00Z'),
      updated_at: new Date('2026-08-01T00:00:00Z'),
    };

    repositoryMock.findByUserId.mockResolvedValue(existing);

    const result = await service.getSettings('user-2');

    expect(result.notification_preferences).toMatchObject({
      system: true,
      financeBot: {
        enabled: true,
        reminderTime2: '22:00',
      },
    });
    expect(repositoryMock.updateByUserId).toHaveBeenCalledWith('user-2', {
      notification_preferences: {
        system: true,
        budgets: true,
        accounts: true,
        investments: true,
        savingGoals: true,
        transactions: true,
        financeBot: {
          enabled: true,
          reminderTime2: '22:00',
        },
      },
    });
  });
});
