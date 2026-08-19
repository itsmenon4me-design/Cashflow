import { Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { NotificationEntity } from '../entities/notification.entity';
import { toNotificationResponse } from '../mappers/notification.mapper';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { PrismaNotificationsRepository } from '../repositories/prisma-notifications.repository';

export interface NotificationListResultDto {
  data: NotificationResponseDto[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: PrismaNotificationsRepository) {}

  async list(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationListResultDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.repository.list(userId, {
      page,
      limit,
      unread:
        query.unread === 'true'
          ? true
          : query.unread === 'false'
            ? false
            : undefined,
      type: query.type,
    });

    const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / limit);

    return {
      data: result.items.map((item) => toNotificationResponse(item)),
      pagination: {
        page,
        limit,
        totalItems: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const updated = await this.repository.markRead(id, userId);
    if (!updated) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Notification not found');
    }
    return toNotificationResponse(updated);
  }

  async markAllRead(userId: string): Promise<number> {
    return this.repository.markAllRead(userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.remove(id, userId);
    if (!deleted) {
      throw ErrorService.create(ErrorCode.NOT_FOUND, 'Notification not found');
    }
  }

  async removeAll(userId: string): Promise<number> {
    return this.repository.removeAll(userId);
  }

  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: unknown,
  ): Promise<NotificationEntity> {
    return this.repository.create({
      user_id: userId,
      type,
      title,
      message,
      metadata,
    });
  }

  /**
   * Create a notification only if a notification with the same dedupe key does not already exist.
   * dedupeKey should be a deterministic string representing uniqueness for the rule.
   */
  async createIfNotExists(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: unknown,
    dedupeKey?: string,
  ): Promise<NotificationEntity> {
    if (dedupeKey) {
      const existing = await this.repository.findByDedupeKey(userId, dedupeKey);
      if (existing) return existing;
    }

    const metaWithDedupe = dedupeKey
      ? { ...(metadata as Record<string, unknown> | undefined), dedupeKey }
      : metadata;

    try {
      return await this.create(userId, type, title, message, metaWithDedupe);
    } catch (err) {
      // Handle unique constraint race: if another process inserted the same dedupe concurrently,
      // try to return the existing notification instead of failing hard.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const code = err?.code;
      const isPrismaErr = code === 'P2002';
      if (isPrismaErr && dedupeKey) {
        const existingAfter = await this.repository.findByDedupeKey(
          userId,
          dedupeKey,
        );
        if (existingAfter) return existingAfter;
      }
      // Not a dedupe race - rethrow
      throw err;
    }
  }

  async findByDedupeKey(
    userId: string,
    dedupeKey: string,
  ): Promise<NotificationEntity | null> {
    return this.repository.findByDedupeKey(userId, dedupeKey);
  }
}
