import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as webPush from 'web-push';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationEntity } from '../entities/notification.entity';
import {
  CreatePushSubscriptionDto,
  PushSubscriptionEndpointDto,
} from '../dto/push-subscription.dto';

interface VapidConfiguration {
  publicKey: string;
}

interface PushPreferences {
  [key: string]: unknown;
  financeBot?: unknown;
}

const FINANCE_BOT_TYPES = new Set([
  'BUDGET_THRESHOLD',
  'BUDGET_EXCEEDED',
  'DAILY_RECORDING_REMINDER',
  'DAILY_RECORDING_ESCALATION',
  'RECORDING_RECOVERY',
]);

const NOTIFICATION_CATEGORY: Record<string, string> = {
  TRANSACTION: 'transactions',
  BUDGET: 'budgets',
  SAVING_GOAL: 'savingGoals',
  ACCOUNT: 'accounts',
  INVESTMENT: 'investments',
  SYSTEM: 'system',
};

const PUSH_ENDPOINT_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'web.push.apple.com',
];

const PUSH_ENDPOINT_SUFFIXES = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function isValidVapidKeyPair(publicKey: string, privateKey: string): boolean {
  if (
    !/^[A-Za-z0-9_-]+$/.test(publicKey) ||
    !/^[A-Za-z0-9_-]+$/.test(privateKey)
  ) {
    return false;
  }
  return (
    decodeBase64Url(publicKey).length === 65 &&
    decodeBase64Url(privateKey).length === 32
  );
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly vapid: VapidConfiguration | null;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? '';
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? '';
    const subject = process.env.VAPID_SUBJECT?.trim() ?? '';

    if (!publicKey && !privateKey) {
      this.vapid = null;
      return;
    }

    if (
      !publicKey ||
      !privateKey ||
      !subject ||
      !isValidVapidKeyPair(publicKey, privateKey) ||
      !(subject.startsWith('mailto:') || subject.startsWith('https://'))
    ) {
      this.logger.error(
        'Web Push is disabled because VAPID configuration is incomplete or invalid.',
      );
      this.vapid = null;
      return;
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    this.vapid = { publicKey };
  }

  getPublicConfig(): { enabled: boolean; publicKey: string | null } {
    return {
      enabled: this.vapid !== null,
      publicKey: this.vapid?.publicKey ?? null,
    };
  }

  async saveSubscription(
    userId: string,
    input: CreatePushSubscriptionDto,
  ): Promise<void> {
    this.requireConfigured();
    this.validatePushEndpoint(input.endpoint);
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: input.endpoint },
      select: { user_id: true },
    });
    if (existing && existing.user_id !== userId) {
      throw new ConflictException(
        'This device is already linked to another account.',
      );
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      update: {
        user_id: userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }

  async removeSubscription(
    userId: string,
    input: PushSubscriptionEndpointDto,
  ): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { user_id: userId, endpoint: input.endpoint },
    });
  }

  async sendForNotification(notification: NotificationEntity): Promise<void> {
    if (!this.vapid || !(await this.isPushEnabled(notification))) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { user_id: notification.user_id },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) return;

    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: notification.user_id },
      select: { language: true },
    });
    const body =
      settings?.language === 'en'
        ? 'You have a new notification. Open CashFlow to view details.'
        : 'Ada notifikasi baru. Buka CashFlow untuk melihat detail.';
    const payload = JSON.stringify({
      title: 'CashFlow',
      body,
      data: { url: '/notifications' },
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          { TTL: 60 },
        ),
      ),
    );

    await Promise.all(
      results.map(async (result, index) => {
        if (result.status === 'fulfilled') return;

        const error = result.reason as {
          statusCode?: unknown;
          message?: unknown;
        };
        const statusCode =
          typeof error?.statusCode === 'number' ? error.statusCode : undefined;
        const subscription = subscriptions[index];
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.deleteMany({
            where: { id: subscription.id },
          });
          return;
        }

        this.logger.warn(
          `Web Push delivery failed for subscription ${subscription.id}: ${
            typeof error?.message === 'string'
              ? error.message
              : 'Unknown delivery error'
          }`,
        );
      }),
    );
  }

  private requireConfigured(): void {
    if (!this.vapid) {
      throw new ServiceUnavailableException(
        'Web Push is not configured on this server.',
      );
    }
  }

  private validatePushEndpoint(endpoint: string): void {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new BadRequestException('Invalid push service endpoint.');
    }

    const hostname = url.hostname.toLowerCase();
    const trustedHost =
      PUSH_ENDPOINT_HOSTS.includes(hostname) ||
      PUSH_ENDPOINT_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    if (
      url.protocol !== 'https:' ||
      !trustedHost ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    ) {
      throw new BadRequestException('Unsupported push service endpoint.');
    }
  }

  private async isPushEnabled(
    notification: NotificationEntity,
  ): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { user_id: notification.user_id },
      select: { notification_preferences: true },
    });
    const preferences = isRecord(settings?.notification_preferences)
      ? (settings.notification_preferences as PushPreferences)
      : {};
    const metadata = isRecord(notification.metadata)
      ? notification.metadata
      : {};
    const ruleType =
      typeof metadata.ruleType === 'string' ? metadata.ruleType : undefined;
    const isFinanceBot =
      FINANCE_BOT_TYPES.has(notification.type) ||
      (ruleType !== undefined && FINANCE_BOT_TYPES.has(ruleType));

    if (isFinanceBot) {
      const financeBot = isRecord(preferences.financeBot)
        ? preferences.financeBot
        : {};
      return financeBot.enabled === true;
    }

    const category = NOTIFICATION_CATEGORY[notification.type];
    if (!category) return false;
    const preference = preferences[category];
    return preference === undefined ? true : preference === true;
  }
}
