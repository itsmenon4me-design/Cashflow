import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNotificationStore } from '@/stores/notification.store';
import { useAuthStore } from '@/stores/auth.store';
import { HeaderBar } from '@/components/layout/header-bar';
import { uiText } from '@/locales';
import { useLanguageStore } from '@/stores/language.store';

const mockPush = vi.fn();
const mockPathname = vi.fn(() => "/");

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

describe('HeaderBar', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPathname.mockReturnValue('/');
    useLanguageStore.getState().setLanguage('id');
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
      hydrated: true,
      setUser: () => {},
      loginSession: async () => {},
    });
  });

  afterEach(() => {
    useLanguageStore.getState().setLanguage('id');
    vi.restoreAllMocks();
  });

  it('updates accessible labels when the interface language changes', () => {
    render(<HeaderBar />);

    expect(screen.getByLabelText('Buka menu navigasi')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifikasi')).toBeInTheDocument();

    act(() => {
      useLanguageStore.getState().setLanguage('en');
    });

    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
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

  it('shows a neutral profile skeleton before auth hydration', () => {
    useAuthStore.setState({ hydrated: false, user: null });

    render(<HeaderBar />);

    expect(screen.getByLabelText('Memuat profil')).toBeInTheDocument();
    expect(screen.queryByText('U')).not.toBeInTheDocument();
  });

  it('does not show Quick Add in the header', () => {
    mockPathname.mockReturnValue('/');
    render(<HeaderBar />);
    expect(screen.queryByLabelText(uiText.common.quickAdd)).not.toBeInTheDocument();
  });

  it('keeps the mobile search input in the main header row', async () => {
    const user = userEvent.setup();
    render(<HeaderBar />);

    await user.click(screen.getByRole('button', {
      name: uiText.common.searchAriaLabel,
    }));

    const header = document.querySelector('header');
    const mobileSearch = screen.getAllByRole('combobox', {
      name: uiText.common.searchAriaLabel,
    })[1];
    expect(header).not.toBeNull();
    expect(mobileSearch.closest('header > div')).toBe(header?.firstElementChild);
    expect(header?.querySelector(':scope > div.border-t')).toBeNull();
  });

  it('removes the close button and collapses mobile search when the page scrolls', async () => {
    const user = userEvent.setup();
    render(<HeaderBar />);

    await user.click(screen.getByRole('button', {
      name: uiText.common.searchAriaLabel,
    }));

    expect(screen.getAllByRole('combobox', {
      name: uiText.common.searchAriaLabel,
    })).toHaveLength(2);
    expect(screen.queryByRole('button', {
      name: uiText.common.closeAriaLabel,
    })).not.toBeInTheDocument();

    fireEvent.scroll(document);

    expect(screen.getAllByRole('combobox', {
      name: uiText.common.searchAriaLabel,
    })).toHaveLength(1);
  });

  it('collapses mobile search after route changes or Escape', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HeaderBar />);

    await user.click(screen.getByRole('button', {
      name: uiText.common.searchAriaLabel,
    }));
    mockPathname.mockReturnValue('/transactions');
    rerender(<HeaderBar />);
    expect(screen.getAllByRole('combobox', {
      name: uiText.common.searchAriaLabel,
    })).toHaveLength(1);

    await user.click(screen.getByRole('button', {
      name: uiText.common.searchAriaLabel,
    }));
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('combobox', {
      name: uiText.common.searchAriaLabel,
    })).toHaveLength(1);
  });

  it('uses a non-scrollable header container to prevent horizontal overflow', () => {
    render(<HeaderBar />);

    const header = document.querySelector('header');
    expect(header).not.toBeNull();
    expect(header).toHaveClass('overflow-hidden');
  });
});
