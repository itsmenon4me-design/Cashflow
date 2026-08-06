"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uiText } from "@/locales";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionStatus, TransactionType } from "@/types/dashboard";

interface TransactionFiltersProps {
  filters: TransactionFiltersState;
  categories: string[];
  accounts: string[];
  onChange: (filters: TransactionFiltersState) => void;
  onReset: () => void;
}

export function TransactionFilters({
  filters,
  categories,
  accounts,
  onChange,
  onReset,
}: TransactionFiltersProps) {
  const update = (patch: Partial<TransactionFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.common.searchTransactionsPlaceholder}
            aria-label={uiText.common.searchAriaLabel}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.category}
          onValueChange={(category) => update({ category })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.table.category}>
            <SelectValue placeholder={uiText.transactions.allCategories} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.transactions.allCategories}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.account} onValueChange={(account) => update({ account })}>
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.table.account}>
            <SelectValue placeholder={uiText.transactions.allAccounts} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.transactions.allAccounts}</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account} value={account}>
                {account}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(type) => update({ type: type as TransactionType | "all" })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.table.type}>
            <SelectValue placeholder={uiText.common.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.common.allTypes}</SelectItem>
            <SelectItem value="income">{uiText.transactions.typeIncome}</SelectItem>
            <SelectItem value="expense">{uiText.transactions.typeExpense}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(status) => update({ status: status as TransactionStatus | "all" })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.table.status}>
            <SelectValue placeholder={uiText.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.common.allStatuses}</SelectItem>
            <SelectItem value="completed">{uiText.status.completed}</SelectItem>
            <SelectItem value="pending">{uiText.status.pending}</SelectItem>
            <SelectItem value="cancelled">{uiText.status.cancelled}</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="rounded-xl bg-card"
          aria-label={uiText.transactions.startDate}
          value={filters.startDate}
          onChange={(event) => update({ startDate: event.target.value })}
        />

        <Input
          type="date"
          className="rounded-xl bg-card"
          aria-label={uiText.transactions.endDate}
          value={filters.endDate}
          onChange={(event) => update({ endDate: event.target.value })}
        />

        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onReset}
        >
          <RotateCcw />
          {uiText.transactions.resetFilters}
        </Button>
      </CardContent>
    </Card>
  );
}
