"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";
import { TransactionCard, TransactionRowActions } from "@/components/transactions/TransactionCard";
import { PendingSyncBadge } from "@/components/transactions/PendingSyncBadge";
import { CardSkeleton } from "@/components/states/CardSkeleton";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import { Badge } from "@/components/ui/badge";
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
    return (
      <>
        <div className="hidden md:block">
          <TableSkeleton rows={6} columns={8} />
        </div>
        <div className="md:hidden">
          <CardSkeleton variant="list" rows={4} />
        </div>
      </>
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

      <div className="grid gap-4 md:hidden">
        {transactions.map((txn) => (
          <TransactionCard
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
