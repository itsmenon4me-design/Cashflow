"use client";

import { Eye, Pencil, Star, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_TYPE_OPTIONS } from "@/features/accounts/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { AccountItem } from "@/services/account.service";

function typeInfo(type: string) {
  return (
    ACCOUNT_TYPE_OPTIONS.find((option) => option.value === type) ??
    ACCOUNT_TYPE_OPTIONS[ACCOUNT_TYPE_OPTIONS.length - 1]
  );
}

export interface AccountRowActionsProps {
  account: AccountItem;
  onView: (account: AccountItem) => void;
  onEdit: (account: AccountItem) => void;
  onSetDefault: (account: AccountItem) => void;
  onDelete: (account: AccountItem) => void;
  align?: "start" | "end";
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export function AccountRowActions({
  account,
  onView,
  onEdit,
  onSetDefault,
  onDelete,
  align = "start",
}: AccountRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(account) },
    { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(account) },
    ...(account.isDefault
      ? []
      : ([
          {
            label: uiText.accounts.default,
            icon: Star,
            onClick: () => onSetDefault(account),
          },
        ] as RowAction[])),
    {
      label: uiText.common.delete,
      icon: Trash2,
      onClick: () => onDelete(account),
      destructive: true,
    },
  ];

  return (
    <div className={cn("flex items-center gap-0.5", align === "end" && "justify-end")}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.label} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label={`${action.label} ${account.name}`}
                className={cn(
                  "size-11 md:size-8",
                  action.destructive
                    ? "hover:bg-destructive/10 hover:text-destructive"
                    : "hover:text-foreground"
                )}
                onClick={action.onClick}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{action.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface AccountCardProps {
  account: AccountItem;
  onView: (account: AccountItem) => void;
  onEdit: (account: AccountItem) => void;
  onSetDefault: (account: AccountItem) => void;
  onDelete: (account: AccountItem) => void;
}

export function AccountCard({
  account,
  onView,
  onEdit,
  onSetDefault,
  onDelete,
}: AccountCardProps) {
  const info = typeInfo(account.accountType);
  const TypeIcon = info.icon;

  return (
    <Card size="sm" className="shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            style={
              account.color
                ? { backgroundColor: `${account.color}22`, color: account.color }
                : undefined
            }
          >
            <TypeIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {info.label}
              {account.isDefault ? ` · ${uiText.accounts.default}` : ""}
            </p>
          </div>
        </div>

        {account.description && (
          <p className="text-xs text-muted-foreground">{account.description}</p>
        )}

        <p className="text-lg font-semibold tracking-tight">
          {formatMoney(account.balance, account.currency)}
        </p>

        <div className="border-t pt-3">
          <AccountRowActions
            account={account}
            onView={onView}
            onEdit={onEdit}
            onSetDefault={onSetDefault}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}