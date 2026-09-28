import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webPush from 'web-push';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationEntity } from '../entities/notification.entity';
import { PushNotificationsService } from './push-notifications.service';

const notification = (
  type: string,
  metadata: unknown = null,
): NotificationEntity => ({
  id: 'notification-1',
  user_id: 'user-1',
  type,
  title: 'Sensitive budget details',
  message: 'Private category and amount',
  is_read: false,
  read_at: null,
  metadata,
  created_at: new Date(),
  updated_at: new Date(),
});

describe('PushNotificationsService', () => {
  const originalEnvironment = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  const keys = {
    publicKey: Buffer.alloc(65, 1).toString('base64url'),
    privateKey: Buffer.alloc(32, 2).toString('base64url'),
  };
  const pushFindMany = jest.fn();
  const pushDeleteMany = jest.fn();
  const userSettingsFindUnique = jest.fn();
  const prisma = {
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: pushDeleteMany,
      findMany: pushFindMany,
      findUnique: jest.fn(),
    },
    userSettings: {
      findUnique: userSettingsFindUnique,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:push@example.test';
    pushFindMany.mockResolvedValue([
      {
        id: 'subscription-1',
        endpoint: 'https://push.example.test/subscription',
        p256dh: 'p256dh',
        auth: 'auth',
      },
    ]);
    prisma.pushSubscription.findUnique = jest.fn().mockResolvedValue(null);
    pushDeleteMany.mockResolvedValue({ count: 1 });
    userSettingsFindUnique.mockResolvedValue({
      language: 'id',
      notification_preferences: {
        transactions: true,
        budgets: true,
        financeBot: { enabled: true },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnvironment.publicKey === undefined) {
      delete process.env.VAPID_PUBLIC_KEY;
    } else {
      process.env.VAPID_PUBLIC_KEY = originalEnvironment.publicKey;
    }
    if (originalEnvironment.privateKey === undefined) {
      delete process.env.VAPID_PRIVATE_KEY;
    } else {
      process.env.VAPID_PRIVATE_KEY = originalEnvironment.privateKey;
    }
    if (originalEnvironment.subject === undefined) {
      delete process.env.VAPID_SUBJECT;
    } else {
      process.env.VAPID_SUBJECT = originalEnvironment.subject;
    }
  });

  it('honors the matching in-app category preference', async () => {
    userSettingsFindUnique.mockResolvedValue({
      notification_preferences: { transactions: false },
    });
    const send = jest.mocked(webPush.sendNotification);
    const service = new PushNotificationsService(prisma);

    await service.sendForNotification(notification('TRANSACTION'));

    expect(pushFindMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects untrusted push endpoints to prevent server-side request forgery', async () => {
    const service = new PushNotificationsService(prisma);

    await expect(
      service.saveSubscription('user-1', {
        endpoint: 'https://internal.example.test/push',
        keys: { p256dh: 'valid-p256dh-key', auth: 'valid-auth-key' },
      }),
    ).rejects.toThrow('Unsupported push service endpoint.');
  });

  it('does not transfer a push endpoint owned by another account', async () => {
    prisma.pushSubscription.findUnique = jest.fn().mockResolvedValue({
      user_id: 'other-user',
    });
    const service = new PushNotificationsService(prisma);

    await expect(
      service.saveSubscription('user-1', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/token',
        keys: { p256dh: 'valid-p256dh-key', auth: 'valid-auth-key' },
      }),
    ).rejects.toThrow('This device is already linked to another account.');
  });

  it('uses the Finance Bot setting independently from category switches', async () => {
    userSettingsFindUnique.mockResolvedValue({
      notification_preferences: {
        budgets: true,
        financeBot: { enabled: false },
      },
    });
    const send = jest.mocked(webPush.sendNotification);
    const service = new PushNotificationsService(prisma);

    await service.sendForNotification(
      notification('BUDGET_THRESHOLD', { ruleType: 'BUDGET_THRESHOLD' }),
    );

    expect(pushFindMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends generic privacy-safe push content and removes expired subscriptions', async () => {
    const send = jest.mocked(webPush.sendNotification);
    send.mockRejectedValue(
      Object.assign(new Error('Subscription expired'), { statusCode: 410 }),
    );
    const service = new PushNotificationsService(prisma);

    await service.sendForNotification(
      notification('BUDGET', {
        categoryName: 'Private category',
        amount: 500000,
      }),
    );

    const payload = String(send.mock.calls[0]?.[1]);
    expect(payload).toContain('"title":"CashFlow"');
    expect(payload).toContain('Buka CashFlow');
    expect(payload).not.toContain('Private category');
    expect(payload).not.toContain('500000');
    expect(pushDeleteMany).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
    });
  });
});
