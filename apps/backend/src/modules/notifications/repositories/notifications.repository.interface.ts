import { NotificationEntity } from '../entities/notification.entity';

export interface NotificationListOptions {
  page: number;
  limit: number;
  unread?: boolean;
  type?: string;
  /** Ledger currency scope: only notifications carrying this currency in metadata. */
  currency?: string;
}

export interface NotificationListResult {
  items: NotificationEntity[];
  total: number;
}

export interface NotificationCreateData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: unknown;
}

export interface NotificationsRepository {
  list(
    userId: string,
    options: NotificationListOptions,
  ): Promise<NotificationListResult>;
  countUnread(userId: string): Promise<number>;
  findOwned(id: string, userId: string): Promise<NotificationEntity | null>;
  markRead(id: string, userId: string): Promise<NotificationEntity | null>;
  markAllRead(userId: string): Promise<number>;
  remove(id: string, userId: string): Promise<boolean>;
  create(data: NotificationCreateData): Promise<NotificationEntity>;
  findByDedupeKey(
    userId: string,
    dedupeKey: string,
  ): Promise<NotificationEntity | null>;
}
