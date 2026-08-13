import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNotificationStore } from '@/stores/notification.store';
import { useAuthStore } from '@/stores/auth.store';
import { HeaderBar } from '@/components/layout/header-bar';
import { uiText } from '@/locales';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('HeaderBar', () => {
  beforeEach(() => {
    mockPush.mockReset();
    useNotificationStore.setState({
      unreadCount: 0,
      recent: [],
      initialized: true,
      fetch: async () => {},
      markAllRead: async () => {},
      remove: () => {},
    });
    useAuthStore.setState({
      user: { name: 'Test User', email: 'test@example.com' },
      logout: vi.fn(),
      isAuthenticated: true,
      setUser: () => {},
      loginSession: async () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to the expected routes for Finance Bot notifications in the header dropdown', async () => {
    useNotificationStore.setState({
      unreadCount: 5,
      recent: [
        {
          id: 'n-budget-threshold',
          type: 'BUDGET_THRESHOLD',
          title: 'Budget threshold alert',
          message: 'You are nearing your budget limit.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { ruleType: 'BUDGET_THRESHOLD', priority: 'MEDIUM' },
        },
        {
          id: 'n-budget-exceeded',
          type: 'BUDGET_EXCEEDED',
          title: 'Budget exceeded',
          message: 'You have exceeded your budget.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { ruleType: 'BUDGET_EXCEEDED', priority: 'HIGH' },
        },
        {
          id: 'n-daily-reminder',
          type: 'DAILY_RECORDING_REMINDER',
          title: 'Daily reminder',
          message: 'Reminder to record your transaction today.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { ruleType: 'DAILY_RECORDING_REMINDER', priority: 'LOW' },
        },
        {
          id: 'n-daily-escalation',
          type: 'DAILY_RECORDING_ESCALATION',
          title: 'Daily escalation',
          message: 'Please record your transactions now.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { ruleType: 'DAILY_RECORDING_ESCALATION', priority: 'HIGH' },
        },
        {
          id: 'n-recording-recovery',
          type: 'RECORDING_RECOVERY',
          title: 'Recording recovery',
          message: 'Welcome back to recording transactions.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { ruleType: 'RECORDING_RECOVERY', priority: 'LOW' },
        },
        {
          id: 'n-legacy',
          type: 'SYSTEM',
          title: 'System update',
          message: 'A system update was applied.',
          isRead: false,
          readAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: null,
        },
      ],
      initialized: true,
      loading: false,
      error: false,
      fetch: async () => {},
      markAllRead: async () => {},
      remove: () => {},
    });

    render(<HeaderBar />);

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('Budget threshold alert'));
    expect(mockPush).toHaveBeenLastCalledWith('/budgets');

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('Budget exceeded'));
    expect(mockPush).toHaveBeenLastCalledWith('/budgets');

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('Daily reminder'));
    expect(mockPush).toHaveBeenLastCalledWith('/transactions');

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('Daily escalation'));
    expect(mockPush).toHaveBeenLastCalledWith('/transactions');

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('Recording recovery'));
    expect(mockPush).toHaveBeenLastCalledWith('/transactions');

    await userEvent.click(screen.getByLabelText(uiText.common.notificationsAriaLabel));
    await userEvent.click(screen.getByText('System update'));
    expect(mockPush).toHaveBeenLastCalledWith('/notifications');
  });
});
