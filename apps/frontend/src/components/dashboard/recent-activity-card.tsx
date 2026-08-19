"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  LogIn,
  LogOut,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Tags,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/features/notifications/relative-time";
import { uiText } from "@/locales";
import { auditLogService } from "@/services/audit-log.service";
import type { AuditLogItem } from "@/types/audit-log";
import { useDataRefreshStore } from "@/stores/refresh.store";

interface ActionConfig {
  icon: LucideIcon;
  label: string;
}

function getActionConfig(): Record<string, ActionConfig> {
  return {
    TRANSACTION_CREATED: { icon: Plus, label: uiText.activity.transactionCreated },
    TRANSACTION_UPDATED: { icon: Pencil, label: uiText.activity.transactionUpdated },
    TRANSACTION_DELETED: { icon: Trash2, label: uiText.activity.transactionDeleted },
    TRANSFER_CREATED: { icon: ArrowLeftRight, label: uiText.activity.transferCreated },
    TRANSFER_FAILED: { icon: ArrowLeftRight, label: uiText.activity.transferFailed },
    BUDGET_CREATED: { icon: PiggyBank, label: uiText.activity.budgetCreated },
    BUDGET_UPDATED: { icon: Pencil, label: uiText.activity.budgetUpdated },
    BUDGET_DELETED: { icon: Trash2, label: uiText.activity.budgetDeleted },
    ACCOUNT_CREATED: { icon: Wallet, label: uiText.activity.accountCreated },
    ACCOUNT_UPDATED: { icon: Pencil, label: uiText.activity.accountUpdated },
    ACCOUNT_DELETED: { icon: Trash2, label: uiText.activity.accountDeleted },
    DEFAULT_ACCOUNT_CHANGED: { icon: Wallet, label: uiText.activity.defaultAccountChanged },
    CATEGORY_CREATED: { icon: Tags, label: uiText.activity.categoryCreated },
    CATEGORY_UPDATED: { icon: Pencil, label: uiText.activity.categoryUpdated },
    CATEGORY_DELETED: { icon: Trash2, label: uiText.activity.categoryDeleted },
    SAVING_GOAL_CREATED: { icon: Target, label: uiText.activity.savingGoalCreated },
    SAVING_GOAL_UPDATED: { icon: Pencil, label: uiText.activity.savingGoalUpdated },
    SAVING_GOAL_DELETED: { icon: Trash2, label: uiText.activity.savingGoalDeleted },
    INVESTMENT_CREATED: { icon: TrendingUp, label: uiText.activity.investmentCreated },
    INVESTMENT_UPDATED: { icon: Pencil, label: uiText.activity.investmentUpdated },
    INVESTMENT_DELETED: { icon: Trash2, label: uiText.activity.investmentDeleted },
    AUTH_LOGIN: { icon: LogIn, label: uiText.activity.login },
    AUTH_LOGOUT: { icon: LogOut, label: uiText.activity.logout },
    AUTH_REFRESH_TOKEN: { icon: RefreshCw, label: uiText.activity.refreshToken },
    AUTH_PASSWORD_CHANGED: { icon: Lock, label: uiText.activity.passwordChanged },
    USER_CREATED: { icon: UserRound, label: uiText.activity.userCreated },
    USER_UPDATED: { icon: Pencil, label: uiText.activity.userUpdated },
    USER_DELETED: { icon: Trash2, label: uiText.activity.userDeleted },
    ROLE_CHANGED: { icon: ShieldCheck, label: uiText.activity.roleChanged },
    PERMISSION_CHANGED: { icon: ShieldCheck, label: uiText.activity.permissionChanged },
  };
}

function getFallbackConfig(): ActionConfig {
  return {
    icon: ReceiptText,
    label: uiText.activity.fallback,
  };
}

function resolveAction(action: string): ActionConfig {
  return getActionConfig()[action] ?? getFallbackConfig();
}

const SKELETON_ROWS = 5;

export function RecentActivityCard() {
  const dataVersion = useDataRefreshStore((state) => state.version);
  const [expanded, setExpanded] = useState(true);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await auditLogService.listOwn({ limit: 10 });
        if (!cancelled) {
          setItems(result.items);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [dataVersion, retryKey]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-5">
        <CardTitle className="text-lg font-semibold">{uiText.dashboard.recentActivities}</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="recent-activity-content"
            aria-label={expanded ? uiText.dashboard.collapseSection : uiText.dashboard.expandSection}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                !expanded && "-rotate-90"
              )}
            />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent id="recent-activity-content" className="p-5 pt-0">
        {!expanded ? (
          <div className="flex items-center justify-between gap-2 py-1">
            <p className="text-sm text-muted-foreground">
              {uiText.common.itemsCount.replace("{count}", String(items.length))}
            </p>
            {items.length > 0 && (
              <Link
                href="/audit-log"
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {uiText.activity.viewAll}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-8 text-center">
            <ReceiptText className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{uiText.activity.errorTitle}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              {uiText.common.tryAgain}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ReceiptText className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{uiText.activity.emptyTitle}</p>
            <p className="text-xs text-muted-foreground">{uiText.activity.emptySubtitle}</p>
          </div>
        ) : (
          <ol className="relative">
            {items.map((item, index) => {
              const config = resolveAction(item.action);
              const Icon = config.icon;
              const isLast = index === items.length - 1;
              return (
                <li key={item.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {!isLast && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <p className="truncate text-sm font-medium text-foreground">{config.label}</p>
                    {item.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!loading && !error && items.length > 0 && (
          <Link
            href="/audit-log"
            className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {uiText.activity.viewAll}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}