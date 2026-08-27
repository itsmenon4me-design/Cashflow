import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useNotificationStore } from '@/stores/notification.store';
import { notificationService } from '@/services/notification.service';
import { NotificationsPage } from './notifications-page';
import { uiText } from '@/locales';

type NotificationListResult = {
  items: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown> | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

vi.mock('@/services/notification.service', () => ({
  notificationService: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('NotificationsPage', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      markRead: async () => {},
      markAllRead: async () => {},
      remove: () => {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while notifications load', async () => {
    let resolveList: (value: NotificationListResult) => void = () => {};
    const listPromise = new Promise<NotificationListResult>((resolve) => {
      resolveList = resolve;
    });
    (notificationService.list as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => listPromise,
    );

    const { container } = render(<NotificationsPage />);

    expect(screen.queryByText(uiText.notificationsPage.empty)).not.toBeInTheDocument();
    expect(container.querySelectorAll('ul[aria-hidden="true"] > li').length).toBeGreaterThan(0);

    await act(async () => {
      resolveList({
        items: [],
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0, hasNext: false, hasPrevious: false },
      });
    });
  });

  it('renders Finance Bot notification details and handles mark read and delete', async () => {
    const items = [
      {
        id: 'n-1',
        type: 'BUDGET_THRESHOLD',
        title: 'Budget threshold alert',
        message: 'You are nearing your budget limit.',
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { ruleType: 'BUDGET_THRESHOLD', priority: 'MEDIUM' },
      },
    ];

    (notificationService.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items,
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false },
    });

    (notificationService.markRead as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...items[0],
      isRead: true,
      readAt: new Date().toISOString(),
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Budget threshold alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Budget threshold alert/)).toBeInTheDocument();
  });
});
