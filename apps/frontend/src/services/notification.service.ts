import { apiClient } from "@/lib/axios";
import type { NotificationItem, NotificationType, PaginationInfo } from "@/types/notification";

interface NotificationDTO {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

type NotificationListPayload = {
  success: boolean;
  data?: NotificationDTO[] | { items?: NotificationDTO[]; pagination?: PaginationInfo };
  items?: NotificationDTO[];
  pagination?: PaginationInfo;
};

interface UnreadCountBody {
  success: boolean;
  data: { unreadCount: number };
}

function toNotificationItem(dto: NotificationDTO): NotificationItem {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    message: dto.message,
    isRead: dto.is_read,
    readAt: dto.read_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    metadata: dto.metadata,
  };
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
  type?: NotificationType;
}

export interface NotificationListResult {
  items: NotificationItem[];
  pagination: PaginationInfo;
}

export const notificationService = {
  list: async (params: NotificationListParams = {}): Promise<NotificationListResult> => {
    const query: Record<string, unknown> = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    };
    if (params.unread !== undefined) query.unread = String(params.unread);
    if (params.type) query.type = params.type;

    const body = await apiClient.get<NotificationListPayload>("/notifications", { params: query });
    const data = body.data;
    const items = Array.isArray(data)
      ? data
      : Array.isArray(body.items)
        ? body.items
        : Array.isArray(data && typeof data === "object" && "items" in data ? data.items : undefined)
          ? (data as { items?: NotificationDTO[] }).items ?? []
          : [];

    const pagination = body.pagination ??
      (data && typeof data === "object" && "pagination" in data ? data.pagination : undefined) ?? {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        totalItems: items.length,
        totalPages: items.length === 0 ? 0 : 1,
        hasNext: false,
        hasPrevious: false,
      };

    return {
      items: items.map(toNotificationItem),
      pagination,
    };
  },

  unreadCount: async (): Promise<number> => {
    const body = await apiClient.get<UnreadCountBody>("/notifications/unread-count");
    return body.data.unreadCount;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const body = await apiClient.patch<{ success: boolean; data: NotificationDTO }>(
      `/notifications/${id}/read`
    );
    return toNotificationItem(body.data);
  },

  markAllRead: async (): Promise<number> => {
    const body = await apiClient.patch<{ success: boolean; data: { updatedCount: number } }>(
      "/notifications/read-all"
    );
    return body.data.updatedCount;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete<{ success: boolean }>(`/notifications/${id}`);
  },

  removeAll: async (): Promise<void> => {
    await apiClient.delete<{ success: boolean }>("/notifications");
  },
};