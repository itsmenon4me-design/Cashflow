"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { TransactionMobileRow, TransactionRowActions } from "@/components/transactions/TransactionCard";
import { PendingSyncBadge } from "@/components/transactions/PendingSyncBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { transactionTone } from "@/lib/transaction-tone";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { TransactionListParams } from "@/services/transaction.service";
import type { TransactionItem } from "@/types/dashboard";

export type TransactionSortKey = NonNullable<TransactionListParams["sortBy"]>;

interface SortButtonProps {
  column: TransactionSortKey;
  sortBy?: TransactionSortKey;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: TransactionSortKey) => void;
  className?: string;
  children: React.ReactNode;
}

function SortButton({
  column,
  sortBy,
  sortOrder,
  onSortChange,
  className,
  children,
}: SortButtonProps) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSortChange?.(column)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        active && "text-foreground",
        sortBy === undefined && "hover:text-muted-foreground",
        className
      )}
    >
      {children}
      {active ? (
        sortOrder === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-50" />
      )}
    </button>
  );
}

interface TransactionTableProps {
  transactions: TransactionItem[];
  loading?: boolean;
  sortBy?: TransactionSortKey;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: TransactionSortKey) => void;
  onView: (transaction: TransactionItem) => void;
  onEdit: (transaction: TransactionItem) => void;
  onDuplicate: (transaction: TransactionItem) => void;
  onDelete: (transaction: TransactionItem) => void;
  // Hide the explicit Type column when the surrounding page already indicates the type (e.g., Income/Expense pages)
  hideTypeColumn?: boolean;
}

export function TransactionTable({
  transactions,
  loading = false,
  sortBy,
  sortOrder,
  onSortChange,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  hideTypeColumn = false,
}: TransactionTableProps) {
  if (loading) {
    const rows = 6;

    return (
      <div
        role="status"
        aria-label={uiText.common.loading}
        aria-live="polite"
        className="min-h-[360px] overflow-hidden rounded-xl bg-card"
      >
        <div className="hidden md:block">
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead><Skeleton className="h-3 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-3 w-24" /></TableHead>
                  <TableHead className="hidden xl:table-cell"><Skeleton className="h-3 w-40" /></TableHead>
                  {!hideTypeColumn && <TableHead><Skeleton className="h-3 w-16" /></TableHead>}
                  <TableHead className="text-right"><Skeleton className="ml-auto h-3 w-24" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="ml-auto h-3 w-16" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: rows }, (_, row) => (
                  <TableRow key={row} className="hover:bg-transparent">
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-lg" /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    {!hideTypeColumn && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                    <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto flex items-center gap-0.5">
                        {Array.from({ length: 4 }, (_, action) => (
                          <Skeleton key={action} className="size-8" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3"
            >
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-5 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-5 w-24" />
              <div className="col-span-2 flex min-w-0 justify-end border-t border-border/80 pt-1">
                <div className="flex min-w-0 gap-0.5">
                  {Array.from({ length: 4 }, (_, action) => (
                    <Skeleton key={action} className="size-11 shrink-0 rounded-md" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <SortButton
                    column="date"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={onSortChange}
                  >
                    {uiText.table.date}
                  </SortButton>
                </TableHead>
                <TableHead>{uiText.table.category}</TableHead>
                <TableHead className="hidden xl:table-cell">
                  {uiText.table.description}
                </TableHead>
                {!hideTypeColumn && <TableHead>{uiText.table.type}</TableHead>}
                <TableHead className="text-right">
                  <SortButton
                    column="amount"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={onSortChange}
                    className="justify-end"
                  >
                    {uiText.table.amount}
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => {
                const tone = transactionTone(txn.type);
                return (
                  <TableRow key={txn.id} data-transaction-id={txn.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTransactionDate(txn.dateTime ?? txn.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="rounded-lg bg-muted">
                          {categoryLabel(txn.category)}
                        </Badge>
                        {txn.pendingSync && <PendingSyncBadge />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 truncate font-medium xl:table-cell">
                      {txn.description}
                    </TableCell>
                    {!hideTypeColumn && (
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-lg",
                              tone.chipClass
                            )}
                          >
                            {txn.type === "income" ? (
                              <ArrowDownToLine className="size-3.5" />
                            ) : (
                              <ArrowUpFromLine className="size-3.5" />
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {txn.type === "income"
                              ? uiText.transactions.typeIncome
                              : uiText.transactions.typeExpense}
                          </span>
                        </span>
                      </TableCell>
                    )}
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        tone.amountClass
                      )}
                    >
                      {tone.sign}
                      {formatCurrency(txn.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TransactionRowActions
                        transaction={txn}
                        onView={onView}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onDelete={onDelete}
                        align="end"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div role="list" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden">
        {transactions.map((txn) => (
          <TransactionMobileRow
            key={txn.id}
            transaction={txn}
            onView={onView}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}
