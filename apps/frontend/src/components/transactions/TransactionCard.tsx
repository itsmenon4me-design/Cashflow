"use client";

import {
  Copy,
  Eye,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { PendingSyncBadge } from "@/components/transactions/PendingSyncBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { transactionTone } from "@/lib/transaction-tone";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { TransactionItem } from "@/types/dashboard";

interface TransactionCardProps {
  transaction: TransactionItem;
  timeZone?: string;
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

export function TransactionMobileRow({
  transaction,
  timeZone,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: TransactionCardProps) {
  const tone = transactionTone(transaction.type);

  return (
    <div
      role="listitem"
      data-transaction-id={transaction.id}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3"
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-xs text-muted-foreground">
          {formatTransactionDate(transaction.dateTime ?? transaction.date, timeZone)}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="max-w-full truncate rounded-lg bg-muted">
            {categoryLabel(transaction.category)}
          </Badge>
          {transaction.pendingSync && <PendingSyncBadge />}
        </div>
        {transaction.description && (
          <p className="truncate text-xs text-muted-foreground">
            {transaction.description}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-end gap-1">
        <p className={cn("whitespace-nowrap text-right text-sm font-semibold tabular-nums", tone.amountClass)}>
          {tone.sign}
          {formatCurrency(transaction.amount)}
        </p>
      </div>
      <div className="col-span-2 flex justify-end border-t border-border/80 pt-1">
        <TransactionRowActions
          transaction={transaction}
          onView={onView}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
