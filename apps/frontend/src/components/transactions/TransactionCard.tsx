"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Eye,
  Landmark,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { TransactionStatusBadge } from "@/components/transactions/TransactionStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { TransactionItem } from "@/types/dashboard";

interface TransactionCardProps {
  transaction: TransactionItem;
  onView: (transaction: TransactionItem) => void;
  onEdit: (transaction: TransactionItem) => void;
  onDuplicate: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
}

interface RowAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
}

export interface TransactionRowActionsProps {
  transaction: TransactionItem;
  onView: (transaction: TransactionItem) => void;
  onEdit: (transaction: TransactionItem) => void;
  onDuplicate: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
  align?: "start" | "end";
}

export function TransactionRowActions({
  transaction,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  align = "start",
}: TransactionRowActionsProps) {
  const actions: RowAction[] = [
    { label: uiText.common.view, icon: Eye, onClick: () => onView(transaction) },
    { label: uiText.common.edit, icon: Pencil, onClick: () => onEdit(transaction) },
    { label: uiText.common.duplicate, icon: Copy, onClick: () => onDuplicate(transaction) },
    {
      label: uiText.common.delete,
      icon: Trash2,
      onClick: () => onDelete(transaction),
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
                aria-label={`${action.label} ${transaction.description}`}
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

export function TransactionCard({
  transaction,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: TransactionCardProps) {
  const isIncome = transaction.type === "income";

  return (
    <Card size="sm" className="shadow-sm" data-transaction-id={transaction.id}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                isIncome ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
              )}
            >
              {isIncome ? (
                <ArrowDownToLine className="size-4" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {transaction.description}
              </p>
              <p className="truncate text-xs text-muted-foreground">{transaction.category}</p>
            </div>
          </div>
          <TransactionStatusBadge status={transaction.status} />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTransactionDate(transaction.date)}</span>
          <span className="flex min-w-0 items-center gap-1">
            <Landmark className="size-3.5 shrink-0" />
            <span className="truncate">{transaction.account}</span>
          </span>
        </div>

        <p
          className={cn(
            "text-lg font-semibold tracking-tight",
            isIncome ? "text-emerald-500" : "text-foreground"
          )}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </p>

        <div className="border-t pt-3">
          <TransactionRowActions
            transaction={transaction}
            onView={onView}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </CardContent>
    </Card>
  );
}
