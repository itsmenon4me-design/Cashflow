import { ArrowLeftRight, BellRing, PiggyBank, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { uiText } from "@/locales";
import type { NotificationItem, NotificationType } from "@/types/notification";

interface NotificationTypeConfig {
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
}

const FINANCE_BOT_RULE_LABELS: Record<string, string> = {
  BUDGET_THRESHOLD: uiText.financeBot.notificationTypeLabels.budgetThreshold,
  BUDGET_EXCEEDED: uiText.financeBot.notificationTypeLabels.budgetExceeded,
  DAILY_RECORDING_REMINDER: uiText.financeBot.notificationTypeLabels.dailyRecordingReminder,
  DAILY_RECORDING_ESCALATION: uiText.financeBot.notificationTypeLabels.dailyRecordingEscalation,
  RECORDING_RECOVERY: uiText.financeBot.notificationTypeLabels.recordingRecovery,
};

const FINANCE_BOT_RULE_ROUTES: Record<string, string> = {
  BUDGET_THRESHOLD: "/budgets",
  BUDGET_EXCEEDED: "/budgets",
  DAILY_RECORDING_REMINDER: "/transactions",
  DAILY_RECORDING_ESCALATION: "/transactions",
  RECORDING_RECOVERY: "/transactions",
};

const FINANCE_BOT_PRIORITY_VARIANTS: Record<string, "secondary" | "warning" | "destructive"> = {
  LOW: "secondary",
  MEDIUM: "warning",
  HIGH: "destructive",
};

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  TRANSACTION: {
    icon: ArrowLeftRight,
    iconClassName: "bg-primary/10 text-primary",
    badgeClassName: "bg-primary/15 text-primary",
  },
  BUDGET: {
    icon: PiggyBank,
    iconClassName: "bg-warning/10 text-warning",
    badgeClassName: "bg-warning/15 text-warning",
  },
  SAVING_GOAL: {
    icon: Target,
    iconClassName: "bg-success/10 text-success",
    badgeClassName: "bg-success/15 text-success",
  },
  ACCOUNT: {
    icon: Wallet,
    iconClassName: "bg-info/10 text-info",
    badgeClassName: "bg-info/15 text-info",
  },
  INVESTMENT: {
    icon: TrendingUp,
    iconClassName: "bg-danger/10 text-danger",
    badgeClassName: "bg-danger/15 text-danger",
  },
  SYSTEM: {
    icon: BellRing,
    iconClassName: "bg-muted text-muted-foreground",
    badgeClassName: "bg-muted text-muted-foreground",
  },
  BUDGET_THRESHOLD: {
    icon: BellRing,
    iconClassName: "bg-amber-500/10 text-amber-500",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  BUDGET_EXCEEDED: {
    icon: BellRing,
    iconClassName: "bg-destructive/10 text-destructive",
    badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  DAILY_RECORDING_REMINDER: {
    icon: BellRing,
    iconClassName: "bg-primary/10 text-primary",
    badgeClassName: "bg-primary/15 text-primary",
  },
  DAILY_RECORDING_ESCALATION: {
    icon: BellRing,
    iconClassName: "bg-warning/10 text-warning",
    badgeClassName: "bg-warning/15 text-warning",
  },
  RECORDING_RECOVERY: {
    icon: BellRing,
    iconClassName: "bg-success/10 text-success",
    badgeClassName: "bg-success/15 text-success",
  },
};

export function isFinanceBotNotification(item: NotificationItem): boolean {
  const ruleType = item.metadata?.ruleType;
  return (
    typeof ruleType === "string" && ruleType.length > 0
  ) || Object.prototype.hasOwnProperty.call(FINANCE_BOT_RULE_LABELS, item.type);
}

export function getFinanceBotRuleLabel(item: NotificationItem): string {
  const ruleType = typeof item.metadata?.ruleType === "string" ? item.metadata.ruleType : item.type;
  return FINANCE_BOT_RULE_LABELS[ruleType] ?? ruleType.replace(/_/g, " ");
}

export function getFinanceBotRuleRoute(item: NotificationItem): string | undefined {
  const ruleType = typeof item.metadata?.ruleType === "string" ? item.metadata.ruleType : item.type;
  return FINANCE_BOT_RULE_ROUTES[ruleType];
}

export function getFinanceBotPriorityLabel(item: NotificationItem): string | undefined {
  const priority = item.metadata?.priority;
  if (typeof priority !== "string") return undefined;
  return uiText.financeBot.notificationPriorityLabels[priority as keyof typeof uiText.financeBot.notificationPriorityLabels] ?? priority;
}

export function getFinanceBotPriorityVariant(item: NotificationItem): "secondary" | "warning" | "destructive" {
  const priority = item.metadata?.priority;
  if (typeof priority !== "string") return "secondary";
  return FINANCE_BOT_PRIORITY_VARIANTS[priority] ?? "secondary";
}
