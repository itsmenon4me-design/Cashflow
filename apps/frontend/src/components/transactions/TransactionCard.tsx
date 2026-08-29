"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Eye,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { PendingSyncBadge } from "@/components/transactions/PendingSyncBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { transactionTone } from "@/lib/transaction-tone";
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
  const tone = transactionTone(transaction.type);

  return (
    <Card size="sm" className="shadow-sm" data-transaction-id={transaction.id}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                tone.chipClass
              )}
            >
              {transaction.type === "income" ? (
                <ArrowDownToLine className="size-4" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {transaction.description}
              </p>
              <p className="truncate text-xs text-muted-foreground">{categoryLabel(transaction.category)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {transaction.pendingSync && <PendingSyncBadge />}
          </div>
        </div>

        <div className="flex items-center text-xs text-muted-foreground">
          <span>{formatTransactionDate(transaction.dateTime ?? transaction.date)}</span>
        </div>

        <p
          className={cn(
            "text-lg font-semibold tracking-tight",
            tone.amountClass
          )}
        >
          {tone.sign}
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
