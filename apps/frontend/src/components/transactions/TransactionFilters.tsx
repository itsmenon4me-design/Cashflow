"use client";

import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryLabel, type CategoryGroup } from "@/lib/categories";
import { uiText } from "@/locales";
import type { TransactionFiltersState } from "@/features/transactions/types";
import type { TransactionType } from "@/types/dashboard";

interface TransactionFiltersProps {
  filters: TransactionFiltersState;
  categoryGroups: CategoryGroup[];
  onChange: (filters: TransactionFiltersState) => void;
  onReset: () => void;
  /**
   * The combined /transactions page keeps the "All types" dropdown; dedicated
   * Income/Expense pages already imply the type, so they hide it.
   */
  showTypeFilter?: boolean;
}

export function TransactionFilters({
  filters,
  categoryGroups,
  onChange,
  onReset,
  showTypeFilter = true,
}: TransactionFiltersProps) {
  const update = (patch: Partial<TransactionFiltersState>) => onChange({ ...filters, ...patch });

  const gridCols = showTypeFilter ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <Card className="shadow-sm">
      <CardContent className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${gridCols}`}>
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
            {categoryGroups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.items.map((category) => (
                  <SelectItem key={category} value={category}>
                    {categoryLabel(category)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {showTypeFilter && (
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
        )}

        <div className="space-y-1.5">
          <Label htmlFor="filter-from-date" className="text-xs text-muted-foreground">
            {uiText.transactions.fromDate}
          </Label>
          <Input
            id="filter-from-date"
            type="date"
            className="rounded-xl bg-card lg:max-w-44"
            aria-label={uiText.transactions.fromDate}
            value={filters.startDate}
            onChange={(event) => update({ startDate: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-to-date" className="text-xs text-muted-foreground">
            {uiText.transactions.toDate}
          </Label>
          <Input
            id="filter-to-date"
            type="date"
            className="rounded-xl bg-card lg:max-w-44"
            aria-label={uiText.transactions.toDate}
            value={filters.endDate}
            onChange={(event) => update({ endDate: event.target.value })}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="self-end rounded-xl"
          onClick={onReset}
        >
          <RotateCcw />
          {uiText.transactions.resetFilters}
        </Button>
      </CardContent>
    </Card>
  );
}
