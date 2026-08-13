import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useNotificationStore } from "@/stores/notification.store";
import { NotificationCard } from "@/components/dashboard/NotificationCard";
import { uiText } from "@/locales";
import type { NotificationItem } from "@/types/notification";

const createNotification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "notification-1",
  type: "SYSTEM",
  title: "Notification title",
  message: "Notification message.",
  isRead: false,
  readAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: null,
  ...overrides,
});

describe("NotificationCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useNotificationStore.setState({
        unreadCount: 0,
        recent: [],
        initialized: false,
        loading: false,
        error: false,
        fetch: async () => {},
        markRead: async () => {},
      });
    });
  });

  it("shows skeleton while loading", async () => {
    act(() => {
      useNotificationStore.setState({
        unreadCount: 0,
        recent: [],
        initialized: false,
        loading: true,
        error: false,
        fetch: async () => {},
        markRead: async () => {},
      });
    });

    let container: HTMLElement | null = null;
    await act(async () => {
      container = render(<NotificationCard />).container;
    });

    expect(container!.querySelectorAll("li").length).toBe(3);
  });

  it("shows empty state when there are no notifications", async () => {
    act(() => {
      useNotificationStore.setState({
        unreadCount: 0,
        recent: [],
        initialized: true,
        loading: false,
        error: false,
        fetch: async () => {},
        markRead: async () => {},
      });
    });

    await act(async () => {
      render(<NotificationCard />);
    });

    expect(screen.getAllByText(uiText.notificationsPage.empty).length).toBeGreaterThan(0);
  });

  it("renders notifications, unread count, and finance bot navigation", async () => {
    const item = createNotification({
      type: "BUDGET_THRESHOLD",
      title: "Budget warning",
      metadata: { ruleType: "BUDGET_THRESHOLD", priority: "LOW" },
    });

    useNotificationStore.setState({
      unreadCount: 1,
      recent: [item],
      initialized: true,
      loading: false,
      error: false,
      fetch: async () => {},
      markRead: async () => {},
    });

    await act(async () => {
      render(<NotificationCard />);
    });

    expect(screen.getByText((content) => content?.includes("1") && content.includes(uiText.notificationsPage.unread))).toBeInTheDocument();
    expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(screen.getByText(uiText.financeBot.notificationTypeLabels.budgetThreshold)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uiText.financeBot.openBudget })).toHaveAttribute("href", "/budgets");
  });

  it("calls markRead when the unread action is clicked", () => {
    const markRead = vi.fn();
    const item = createNotification({
      type: "BUDGET_EXCEEDED",
      title: "Budget exceeded",
      metadata: { ruleType: "BUDGET_EXCEEDED", priority: "HIGH" },
    });

    useNotificationStore.setState({
      unreadCount: 1,
      recent: [item],
      initialized: true,
      loading: false,
      error: false,
      fetch: async () => {},
      markRead,
    });

    render(<NotificationCard />);

    fireEvent.click(screen.getByRole("button", { name: `Mark ${item.title} as read` }));
    expect(markRead).toHaveBeenCalledWith(item.id);
  });
});
