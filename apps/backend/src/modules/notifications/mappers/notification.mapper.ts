import { NotificationEntity } from '../entities/notification.entity';
import { NotificationResponseDto } from '../dto/notification-response.dto';

function stripDedupeKey(metadata: unknown): unknown {
  if (typeof metadata !== 'object' || metadata === null) return metadata;

  const copied = { ...(metadata as Record<string, unknown>) };
  delete copied.dedupeKey;
  return copied;
}

export function toNotificationResponse(
  notification: NotificationEntity,
): NotificationResponseDto {
  return {
    id: notification.id,
    user_id: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    is_read: notification.is_read,
    read_at: notification.read_at,
    metadata: stripDedupeKey(notification.metadata),
    created_at: notification.created_at,
    updated_at: notification.updated_at,
  };
}
