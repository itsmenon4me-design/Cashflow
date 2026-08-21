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
import { useDashboardCurrencyStore } from '@/stores/dashboardCurrency.store';

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(useAuthStore, 'subscribe').mockImplementation(() => () => {});
  vi.spyOn(useDashboardCurrencyStore, 'subscribe').mockImplementation(() => () => {});

  // reset auth to unauthenticated by default
  useAuthStore.setState({ isAuthenticated: false });
  useDashboardCurrencyStore.setState({ currency: 'USD', hydrated: true });

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
    // ensure auth is false
    useAuthStore.setState({ isAuthenticated: false });

    await useNotificationStore.getState().fetch();

    expect(notificationService.unreadCount).not.toHaveBeenCalled();
    expect(notificationService.list).not.toHaveBeenCalled();
  });

  it('waits for dashboard currency hydration before calling notification APIs', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    useDashboardCurrencyStore.setState({ currency: 'USD', hydrated: false });

    const subscribeSpy = vi.spyOn(useDashboardCurrencyStore, 'subscribe');
    (notificationService.unreadCount as any).mockResolvedValue(5);
    (notificationService.list as any).mockResolvedValue({ items: [], pagination: {} });

    await useNotificationStore.getState().fetch();

    expect(notificationService.unreadCount).not.toHaveBeenCalled();
    expect(notificationService.list).not.toHaveBeenCalled();

    const listener = subscribeSpy.mock.calls.at(-1)?.[0];
    expect(listener).toBeTypeOf('function');

    useDashboardCurrencyStore.setState({ currency: 'USD', hydrated: true });
    // Call listener with current state; pass the same state as previous to satisfy the listener signature
    const _state = useDashboardCurrencyStore.getState();
    listener?.(_state, _state);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);
    expect(notificationService.list).toHaveBeenCalledTimes(1);
  });

  it('calls notification APIs when authenticated', async () => {
    // make auth true
    useAuthStore.setState({ isAuthenticated: true });

    (notificationService.unreadCount as any).mockResolvedValue(5);
    (notificationService.list as any).mockResolvedValue({ items: [], pagination: {} });

    await useNotificationStore.getState().fetch();

    expect(notificationService.unreadCount).toHaveBeenCalled();
    expect(notificationService.list).toHaveBeenCalled();
  });
});
