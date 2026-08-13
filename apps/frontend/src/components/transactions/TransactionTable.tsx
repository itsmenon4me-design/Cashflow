"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ArrowDownToLine, ArrowUpFromLine, Landmark } from "lucide-react";
import { TransactionCard, TransactionRowActions } from "@/components/transactions/TransactionCard";
import { TransactionStatusBadge } from "@/components/transactions/TransactionStatusBadge";
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
                <TableHead className="hidden lg:table-cell">{uiText.table.account}</TableHead>
                <TableHead>{uiText.table.type}</TableHead>
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
                <TableHead>{uiText.table.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => {
                const isIncome = txn.type === "income";
                return (
                  <TableRow key={txn.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTransactionDate(txn.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg bg-muted">
                        {txn.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-56 truncate font-medium xl:table-cell">
                      {txn.description}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Landmark className="size-3.5 shrink-0" />
                        <span className="truncate">{txn.account}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-lg",
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          {isIncome ? (
                            <ArrowDownToLine className="size-3.5" />
                          ) : (
                            <ArrowUpFromLine className="size-3.5" />
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {isIncome
                            ? uiText.transactions.typeIncome
                            : uiText.transactions.typeExpense}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        isIncome ? "text-emerald-500" : "text-foreground"
                      )}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </TableCell>
                    <TableCell>
                      <TransactionStatusBadge status={txn.status} />
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
