import Link from "next/link";
import { useEffect } from "react";
import { ArrowUpRight, Bell, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import { formatRelativeTime } from "@/features/notifications/relative-time";
import {
  NOTIFICATION_TYPE_CONFIG,
  getFinanceBotPriorityLabel,
  getFinanceBotPriorityVariant,
  getFinanceBotRuleLabel,
  getFinanceBotRuleRoute,
  isFinanceBotNotification,
} from "@/features/notifications/notification-config";
import { useNotificationStore } from "@/stores/notification.store";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { NotificationListSkeleton } from "@/components/notifications/notification-list-skeleton";

export function NotificationCard() {
  const { unreadCount, recent, initialized, loading, error, fetch, markRead } = useNotificationStore();

  useEffect(() => {
    if (!initialized && !loading) {
      void fetch();
    }
  }, [initialized, loading, fetch]);

  const notifications = recent.slice(0, 5);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-5">
        <div>
          <CardTitle className="text-lg font-semibold">{uiText.navigation.notifications}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} ${uiText.notificationsPage.unread}`
              : uiText.notificationsPage.empty}
          </p>
        </div>
        <Bell className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        {loading ? (
          <NotificationListSkeleton rows={3} />
        ) : error ? (
          <ErrorState
            title={uiText.states.errorTitle}
            description={uiText.states.errorDescription}
            onRetry={() => void fetch()}
          />
        ) : notifications.length === 0 ? (
          <EmptyState title={uiText.notificationsPage.empty} description={uiText.states.emptyDefault} />
        ) : (
          <ul className="space-y-3">
            {notifications.map((item) => {
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
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3",
                    item.isRead
                      ? "border-border bg-card"
                      : "border-primary/20 bg-primary/5"
                  )}
                >
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", config.iconClassName)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p title={item.title} className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      {!item.isRead && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      )}
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
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {uiText.notificationsPage.unread}
                        </Badge>
                      )}
                    </div>
                    <p title={item.message} className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                  {ruleRoute && (
                    <Button
                      asChild
                      variant="ghost"
                      className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                      aria-label={ruleActionLabel}
                    >
                      <Link href={ruleRoute}>
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => void markRead(item.id)}
                      aria-label={`Mark ${item.title} as read`}
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Link href="/notifications" className="text-sm font-medium text-primary">
            {uiText.common.viewAll}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
