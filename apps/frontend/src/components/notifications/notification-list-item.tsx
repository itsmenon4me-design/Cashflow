"use client";

import { Check, Trash2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/features/notifications/relative-time";
import {
  NOTIFICATION_TYPE_CONFIG,
  getFinanceBotPriorityLabel,
  getFinanceBotPriorityVariant,
  getFinanceBotRuleLabel,
  getFinanceBotRuleRoute,
  isFinanceBotNotification,
} from "@/features/notifications/notification-config";
import { uiText } from "@/locales";
import type { NotificationItem } from "@/types/notification";
import { cn } from "@/lib/utils";

interface NotificationListItemProps {
  item: NotificationItem;
  onMarkRead?: () => void;
  onDelete?: () => void;
}

export function NotificationListItem({
  item,
  onMarkRead,
  onDelete,
}: NotificationListItemProps) {
  const config = NOTIFICATION_TYPE_CONFIG[item.type] ?? NOTIFICATION_TYPE_CONFIG.SYSTEM;
  const Icon = config.icon;

  const isFinanceBot = isFinanceBotNotification(item);
  const ruleLabel = isFinanceBot ? getFinanceBotRuleLabel(item) : undefined;
  const priorityLabel = isFinanceBot ? getFinanceBotPriorityLabel(item) : undefined;
  const priorityVariant = isFinanceBot ? getFinanceBotPriorityVariant(item) : "secondary";
  const ruleRoute = getFinanceBotRuleRoute(item);
  const ruleActionLabel =
    ruleRoute === "/budgets" ? uiText.financeBot.openBudget : uiText.financeBot.openTransactions;

  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-3",
        item.isRead ? "border-border bg-card" : "border-border bg-card/70"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
          config.iconClassName
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          {isFinanceBot && (
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
              {uiText.financeBot.title}
            </Badge>
          )}
          {ruleLabel && (
            <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
              {ruleLabel}
            </Badge>
          )}
          {priorityLabel && (
            <Badge variant={priorityVariant} className="shrink-0 px-1.5 py-0 text-[10px]">
              {priorityLabel}
            </Badge>
          )}
          {!item.isRead && (
            <Badge variant="neutral" className="shrink-0 px-1.5 py-0 text-[10px]">
              {uiText.notificationsPage.unread}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {ruleRoute && (
          <Button
            asChild
            variant="ghost"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label={ruleActionLabel}
          >
            <Link href={ruleRoute}>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        )}
        {!item.isRead && onMarkRead && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMarkRead}
            aria-label={`${uiText.notificationsPage.markAsRead}: ${item.title}`}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Check className="size-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={`${uiText.notificationsPage.delete}: ${item.title}`}
            className="size-8 rounded-lg text-muted-foreground hover:text-danger"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}