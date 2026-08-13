import { describe, expect, it } from "vitest";
import { uiText } from "@/locales";
import type { NotificationItem } from "@/types/notification";
import {
  getFinanceBotPriorityLabel,
  getFinanceBotPriorityVariant,
  getFinanceBotRuleLabel,
  getFinanceBotRuleRoute,
  isFinanceBotNotification,
} from "@/features/notifications/notification-config";

const createNotification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "notification-1",
  type: "SYSTEM",
  title: "System update",
  message: "Your account has been updated.",
  isRead: false,
  readAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: null,
  ...overrides,
});

describe("notification-config", () => {
  it("detects Finance Bot notification from metadata.ruleType", () => {
    const item = createNotification({
      metadata: { ruleType: "BUDGET_EXCEEDED", priority: "HIGH" },
      type: "SYSTEM",
    });

    expect(isFinanceBotNotification(item)).toBe(true);
    expect(getFinanceBotRuleLabel(item)).toBe(uiText.financeBot.notificationTypeLabels.budgetExceeded);
    expect(getFinanceBotRuleRoute(item)).toBe("/budgets");
  });

  it("detects known Finance Bot notification types without metadata", () => {
    const item = createNotification({ type: "DAILY_RECORDING_REMINDER", metadata: null });

    expect(isFinanceBotNotification(item)).toBe(true);
    expect(getFinanceBotRuleRoute(item)).toBe("/transactions");
    expect(getFinanceBotRuleLabel(item)).toBe(uiText.financeBot.notificationTypeLabels.dailyRecordingReminder);
  });

  it("does not classify normal system notifications as Finance Bot", () => {
    const item = createNotification({ type: "SYSTEM", metadata: null });

    expect(isFinanceBotNotification(item)).toBe(false);
    expect(getFinanceBotRuleRoute(item)).toBeUndefined();
  });

  it("keeps legacy Finance Bot notifications without metadata compatible", () => {
    const item = createNotification({ type: "BUDGET_THRESHOLD", metadata: null });

    expect(isFinanceBotNotification(item)).toBe(true);
    expect(getFinanceBotRuleRoute(item)).toBe("/budgets");
  });

  it("maps Finance Bot rule types to expected routes", () => {
    const routeAssertions: Array<[NotificationItem["type"], string]> = [
      ["BUDGET_THRESHOLD", "/budgets"],
      ["BUDGET_EXCEEDED", "/budgets"],
      ["DAILY_RECORDING_REMINDER", "/transactions"],
      ["DAILY_RECORDING_ESCALATION", "/transactions"],
      ["RECORDING_RECOVERY", "/transactions"],
    ];

    for (const [type, route] of routeAssertions) {
      const item = createNotification({ type, metadata: null });
      expect(getFinanceBotRuleRoute(item)).toBe(route);
    }

    const normal = createNotification({ type: "SYSTEM", metadata: null });
    expect(getFinanceBotRuleRoute(normal)).toBeUndefined();
  });

  it("presents Finance Bot priorities correctly and handles invalid values", () => {
    const low = createNotification({ metadata: { ruleType: "BUDGET_THRESHOLD", priority: "LOW" } });
    const medium = createNotification({ metadata: { ruleType: "BUDGET_THRESHOLD", priority: "MEDIUM" } });
    const high = createNotification({ metadata: { ruleType: "BUDGET_THRESHOLD", priority: "HIGH" } });
    const invalid = createNotification({ metadata: { ruleType: "BUDGET_THRESHOLD", priority: "UNKNOWN" } });
    const missing = createNotification({ metadata: { ruleType: "BUDGET_THRESHOLD" } });

    expect(getFinanceBotPriorityLabel(low)).toBe(uiText.financeBot.notificationPriorityLabels.LOW);
    expect(getFinanceBotPriorityVariant(low)).toBe("secondary");

    expect(getFinanceBotPriorityLabel(medium)).toBe(uiText.financeBot.notificationPriorityLabels.MEDIUM);
    expect(getFinanceBotPriorityVariant(medium)).toBe("warning");

    expect(getFinanceBotPriorityLabel(high)).toBe(uiText.financeBot.notificationPriorityLabels.HIGH);
    expect(getFinanceBotPriorityVariant(high)).toBe("destructive");

    expect(getFinanceBotPriorityLabel(invalid)).toBe("UNKNOWN");
    expect(getFinanceBotPriorityVariant(invalid)).toBe("secondary");

    expect(getFinanceBotPriorityLabel(missing)).toBeUndefined();
    expect(getFinanceBotPriorityVariant(missing)).toBe("secondary");
  });
});
