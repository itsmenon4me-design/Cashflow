import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/notification.service', () => ({
  notificationService: {
    unreadCount: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    removeAll: vi.fn(),
    remove: vi.fn(),
  },
}));

import { useNotificationStore } from './notification.store';
import { notificationService } from '@/services/notification.service';
import { useAuthStore } from '@/stores/auth.store';

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(useAuthStore, 'subscribe').mockImplementation(() => () => {});

  // reset auth to unauthenticated by default
  useAuthStore.setState({ isAuthenticated: false });

  // reset notification store state
  useNotificationStore.setState({
    unreadCount: 0,
    recent: [],
    initialized: false,
    loading: false,
    error: false,
  });
});

describe('notification store - fetch guard', () => {
  it('does NOT call notification APIs when unauthenticated', async () => {
    useAuthStore.setState({ isAuthenticated: false });

    await useNotificationStore.getState().fetch();

    expect(notificationService.unreadCount).not.toHaveBeenCalled();
    expect(notificationService.list).not.toHaveBeenCalled();
  });

  it('calls notification APIs when authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: true });

    (notificationService.unreadCount as any).mockResolvedValue(5);
    (notificationService.list as any).mockResolvedValue({ items: [], pagination: {} });

    await useNotificationStore.getState().fetch();

    expect(notificationService.unreadCount).toHaveBeenCalled();
    expect(notificationService.list).toHaveBeenCalled();
  });
});
