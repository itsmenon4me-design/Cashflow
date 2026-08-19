import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { Notification as NotificationRow } from '../../../generated/prisma/client';
import { NotificationEntity } from '../entities/notification.entity';
import {
  NotificationsRepository,
  NotificationCreateData,
  NotificationListOptions,
  NotificationListResult,
} from './notifications.repository.interface';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: NotificationRow): NotificationEntity {
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      is_read: row.is_read,
      read_at: row.read_at,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async list(
    userId: string,
    options: NotificationListOptions,
  ): Promise<NotificationListResult> {
    const where = {
      user_id: userId,
      ...(options.unread === true ? { is_read: false } : {}),
      ...(options.type ? { type: options.type } : {}),
    };

    const skip = (options.page - 1) * options.limit;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: options.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items: items.map((row) => this.map(row)), total };
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async findOwned(
    id: string,
    userId: string,
  ): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findFirst({
      where: { id, user_id: userId },
    });
    return row ? this.map(row) : null;
  }

  async markRead(
    id: string,
    userId: string,
  ): Promise<NotificationEntity | null> {
    const owned = await this.findOwned(id, userId);
    if (!owned) return null;
    if (owned.is_read) return owned;

    await this.prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });

    return { ...owned, is_read: true, read_at: new Date() };
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return result.count;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.notification.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count > 0;
  }

  async removeAll(userId: string): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: { user_id: userId },
    });
    return result.count;
  }

  create(data: NotificationCreateData): Promise<NotificationEntity> {
    // Extract dedupeKey from metadata if present
    const meta = data.metadata as Record<string, unknown> | undefined;
    const dedupe =
      meta && typeof meta.dedupeKey === 'string' ? meta.dedupeKey : null;

    return this.prisma.notification
      .create({
        data: {
          user_id: data.user_id,
          type: data.type,
          title: data.title,
          message: data.message,
          ...(data.metadata !== undefined && data.metadata !== null
            ? { metadata: data.metadata }
            : {}),
          ...(dedupe ? { dedupe_key: dedupe } : {}),
        },
      })
      .then((row) => this.map(row));
  }

  async findByDedupeKey(
    userId: string,
    dedupeKey: string,
  ): Promise<NotificationEntity | null> {
    const row = await this.prisma.notification.findFirst({
      where: {
        user_id: userId,
        dedupe_key: dedupeKey,
      },
      orderBy: { created_at: 'desc' },
    });
    return row ? this.map(row) : null;
  }
}
