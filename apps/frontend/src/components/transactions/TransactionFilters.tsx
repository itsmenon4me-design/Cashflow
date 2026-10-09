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
import { formatInputDate } from "@/lib/date";
import { cn } from "@/lib/utils";
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

  return (
    <Card className="shadow-sm @container/transaction-filters">
      <CardContent className="space-y-3">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-11 rounded-xl bg-card pl-9"
            placeholder={uiText.common.searchTransactionsPlaceholder}
            aria-label={uiText.common.searchAriaLabel}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <div
          data-slot="transaction-filter-controls"
          className="grid grid-cols-2 items-end gap-3 @lg/transaction-filters:grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),10rem))]"
        >
          <div className={cn(
            "min-w-0 max-w-40",
            !showTypeFilter && "col-span-2",
          )}>
            <Select
              value={filters.category}
              onValueChange={(category) => update({ category })}
            >
              <SelectTrigger className="min-h-11 w-full max-w-40 rounded-xl" aria-label={uiText.table.category}>
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
          </div>

          {showTypeFilter && (
            <div className="min-w-0 max-w-40">
              <Select
                value={filters.type}
                onValueChange={(type) => update({
                  type: type as TransactionType | "all",
                  category: "all",
                })}
              >
                <SelectTrigger className="min-h-11 w-full max-w-40 rounded-xl" aria-label={uiText.table.type}>
                  <SelectValue placeholder={uiText.common.allTypes} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{uiText.common.allTypes}</SelectItem>
                  <SelectItem value="income">{uiText.transactions.typeIncome}</SelectItem>
                  <SelectItem value="expense">{uiText.transactions.typeExpense}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex w-full min-w-0 max-w-40 flex-col gap-1.5">
            <Label htmlFor="filter-from-date" className="translate-x-1 text-center text-xs text-muted-foreground font-normal">
              {uiText.transactions.fromDate}
            </Label>
            <div className="relative flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-border bg-input/30 px-2 text-sm text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
              <span className={cn("pointer-events-none w-full text-center", !filters.startDate && "text-muted-foreground")} aria-hidden="true">
                {formatInputDate(filters.startDate) || uiText.transactions.selectDate}
              </span>
              <Input
                id="filter-from-date"
                type="date"
                className="date-input-no-indicator absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent opacity-0"
                aria-label={uiText.transactions.fromDate}
                value={filters.startDate}
                onClick={(event) => event.currentTarget.showPicker?.()}
                onChange={(event) => update({ startDate: event.target.value })}
              />
            </div>
          </div>

          <div className="flex w-full min-w-0 max-w-40 flex-col gap-1.5">
            <Label htmlFor="filter-to-date" className="translate-x-1 text-center text-xs text-muted-foreground font-normal">
              {uiText.transactions.toDate}
            </Label>
            <div className="relative flex min-h-11 w-full min-w-0 items-center justify-center rounded-xl border border-border bg-input/30 px-2 text-sm text-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
              <span className={cn("pointer-events-none w-full text-center", !filters.endDate && "text-muted-foreground")} aria-hidden="true">
                {formatInputDate(filters.endDate) || uiText.transactions.selectDate}
              </span>
              <Input
                id="filter-to-date"
                type="date"
                className="date-input-no-indicator absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent opacity-0"
                aria-label={uiText.transactions.toDate}
                value={filters.endDate}
                onClick={(event) => event.currentTarget.showPicker?.()}
                onChange={(event) => update({ endDate: event.target.value })}
              />
            </div>
          </div>

          <div
            className={cn(
              "col-span-2 flex min-w-0 justify-center",
              "@lg/transaction-filters:col-span-1 @lg/transaction-filters:justify-start",
            )}
          >
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full rounded-xl @lg/transaction-filters:w-auto @lg/transaction-filters:min-w-36"
              onClick={onReset}
            >
              <RotateCcw />
              {uiText.transactions.resetFilters}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
