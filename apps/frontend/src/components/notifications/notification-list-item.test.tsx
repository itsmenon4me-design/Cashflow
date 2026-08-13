import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import type { NotificationItem } from "@/types/notification";
import { uiText } from "@/locales";

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

describe("NotificationListItem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Finance Bot badge and rule label for finance notifications", () => {
    const item = createNotification({
      type: "BUDGET_THRESHOLD",
      metadata: { ruleType: "BUDGET_THRESHOLD", priority: "MEDIUM", dedupeKey: "dedupe-123" },
    });

    render(<NotificationListItem item={item} onMarkRead={vi.fn()} />);

    expect(screen.getByText(uiText.financeBot.title)).toBeInTheDocument();
    expect(screen.getByText(uiText.financeBot.notificationTypeLabels.budgetThreshold)).toBeInTheDocument();
    expect(screen.getByText(uiText.financeBot.notificationPriorityLabels.MEDIUM)).toBeInTheDocument();
    expect(screen.queryByText("dedupe-123")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: uiText.financeBot.openBudget })).toHaveAttribute("href", "/budgets");
  });

  it("does not display Finance Bot badge for normal notifications", () => {
    const item = createNotification({ type: "SYSTEM", metadata: null });

    render(<NotificationListItem item={item} onMarkRead={vi.fn()} />);

    expect(screen.queryByText(uiText.financeBot.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the correct navigation action for finance notifications and preserves legacy behavior", () => {
    const item = createNotification({
      type: "DAILY_RECORDING_REMINDER",
      metadata: { ruleType: "DAILY_RECORDING_REMINDER", priority: "LOW" },
    });

    render(<NotificationListItem item={item} onMarkRead={vi.fn()} />);

    expect(screen.getByRole("link", { name: uiText.financeBot.openTransactions })).toHaveAttribute(
      "href",
      "/transactions"
    );
  });

  it("calls onMarkRead when the mark-as-read button is clicked and does not delete the notification", () => {
    const onMarkRead = vi.fn();
    const onDelete = vi.fn();
    const item = createNotification({ type: "BUDGET_EXCEEDED", metadata: { ruleType: "BUDGET_EXCEEDED", priority: "HIGH" } });

    render(<NotificationListItem item={item} onMarkRead={onMarkRead} onDelete={onDelete} />);

    const button = screen.getByRole("button", { name: `${uiText.notificationsPage.markAsRead}: ${item.title}` });
    fireEvent.click(button);

    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
