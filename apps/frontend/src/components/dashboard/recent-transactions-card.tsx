"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatTransactionDate } from "@/lib/format";
import CenteredEmptyState from "@/components/states/CenteredEmptyState";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { TransactionItem, TransactionStatus, TransactionType } from "@/types/dashboard";

const PAGE_SIZE = 6;

const statusConfig: Record<TransactionStatus, { label: string; className: string }> = {
  completed: {
    label: uiText.status.completed,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  pending: {
    label: uiText.status.pending,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  cancelled: {
    label: uiText.status.cancelled,
    className: "border-red-500/30 bg-red-500/10 text-red-500",
  },
};

type TypeFilter = "all" | TransactionType;
type StatusFilter = "all" | TransactionStatus;

interface RecentTransactionsCardProps {
  items: TransactionItem[];
}

export function RecentTransactionsCard({ items }: RecentTransactionsCardProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        keyword === "" ||
        item.description.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword);
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [items, query, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>{uiText.dashboard.recentTransactions}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{uiText.common.updatedJustNow}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-56 max-w-full rounded-xl bg-card pl-9"
                placeholder={uiText.common.searchTransactionsPlaceholder}
                aria-label={uiText.common.searchAriaLabel}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl">
                  <Filter />
                  {uiText.common.filters}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{uiText.table.category}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTypeFilter("all")}>
                  {uiText.common.allTypes}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("income")}>
                  {uiText.dashboard.income}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("expense")}>
                  {uiText.dashboard.expense}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{uiText.table.status}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  {uiText.common.allStatuses}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("completed")}>
                  {uiText.status.completed}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  {uiText.status.pending}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("cancelled")}>
                  {uiText.status.cancelled}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative sm:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.common.searchTransactionsPlaceholder}
            aria-label={uiText.common.searchAriaLabel}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{uiText.table.date}</TableHead>
                <TableHead>{uiText.table.category}</TableHead>
                <TableHead>{uiText.table.description}</TableHead>
                <TableHead className="text-right">{uiText.table.amount}</TableHead>
                <TableHead>{uiText.table.status}</TableHead>
                <TableHead className="text-right">{uiText.common.actionLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((txn) => {
                const status = statusConfig[txn.status];
                return (
                  <TableRow key={txn.id}>
                    <TableCell className="text-muted-foreground">
                      {formatTransactionDate(txn.dateTime ?? txn.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg bg-muted">
                        {txn.category}
                      </Badge>
                    </TableCell>
                    <TableCell title={txn.description} className="font-medium min-w-0 truncate">{txn.description}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        txn.type === "income" ? "text-emerald-500" : "text-foreground"
                      )}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-lg", status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${uiText.common.actionLabel} ${txn.description}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => undefined}>{uiText.common.view}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => undefined}>{uiText.common.edit}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => undefined}>
                            {uiText.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <div className="h-32 w-full">
                      <CenteredEmptyState title={(uiText as any)?.dashboard?.emptyRecentTransactions ?? uiText.common.noDataAvailable} description={(uiText as any)?.common?.addTransactionsPrompt ?? uiText.common.addTransaction} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0
              ? uiText.common.noDataAvailable
              : uiText.common.showingRange
                  .replace("{start}", String(startIndex + 1))
                  .replace("{end}", String(startIndex + visibleRows.length))
                  .replace("{total}", String(filtered.length))}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft />
              {uiText.common.prevPage}
            </Button>
            <span className="min-w-24 text-center text-sm text-muted-foreground">
              {uiText.common.pageOf
                .replace("{page}", String(currentPage))
                .replace("{total}", String(totalPages))}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              {uiText.common.nextPage}
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
