import { create } from "zustand";
import { notificationService } from "@/services/notification.service";
import type { NotificationItem } from "@/types/notification";

interface NotificationState {
  unreadCount: number;
  recent: NotificationItem[];
  initialized: boolean;
  loading: boolean;
  error: boolean;
  fetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  recent: [],
  initialized: false,
  loading: false,
  error: false,

  fetch: async () => {
    set({ loading: true, error: false });
    try {
      const [unreadCount, list] = await Promise.all([
        notificationService.unreadCount(),
        notificationService.list({ page: 1, limit: 5 }),
      ]);
      set({ unreadCount, recent: list.items, initialized: true, loading: false, error: false });
    } catch {
      set({ initialized: true, loading: false, error: true });
    }
  },

  markRead: async (id: string) => {
    await notificationService.markRead(id);
    const state = get();
    set({
      recent: state.recent.map((item) =>
        item.id === id && !item.isRead
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    });
  },

  markAllRead: async () => {
    await notificationService.markAllRead();
    set((state) => ({
      recent: state.recent.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() }
      ),
      unreadCount: 0,
    }));
  },

  remove: (id: string) => {
    const state = get();
    const removed = state.recent.find((item) => item.id === id);
    set({
      recent: state.recent.filter((item) => item.id !== id),
      unreadCount:
        removed && !removed.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
    });
  },
}));