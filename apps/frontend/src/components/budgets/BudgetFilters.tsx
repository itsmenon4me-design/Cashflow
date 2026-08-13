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
import {
  BUDGET_SORT_OPTIONS,
  MONTH_OPTIONS,
} from "@/features/budgets/constants";
import type { BudgetFiltersState } from "@/features/budgets/types";
import { uiText } from "@/locales";

export interface BudgetPeriod {
  month: number;
  year: number;
}

interface BudgetFiltersProps {
  filters: BudgetFiltersState;
  years: number[];
  period: BudgetPeriod;
  onChange: (filters: BudgetFiltersState) => void;
  onPeriodChange: (period: BudgetPeriod) => void;
  onReset: () => void;
}

export function BudgetFilters({
  filters,
  years,
  period,
  onChange,
  onPeriodChange,
  onReset,
}: BudgetFiltersProps) {
  const update = (patch: Partial<BudgetFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.budgets.searchPlaceholder}
            aria-label={uiText.budgets.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as BudgetFiltersState["sort"] })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.budgets.sortLabel}>
            <SelectValue placeholder={uiText.budgets.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(period.month)}
          onValueChange={(month) =>
            onPeriodChange({ ...period, month: Number(month) })
          }
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.budgets.month}>
            <SelectValue placeholder={uiText.budgets.month} />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(period.year)}
          onValueChange={(year) => onPeriodChange({ ...period, year: Number(year) })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.budgets.year}>
            <SelectValue placeholder={uiText.budgets.year} />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="rounded-xl" onClick={onReset}>
          <RotateCcw />
          {uiText.transactions.resetFilters}
        </Button>
      </CardContent>
    </Card>
  );
}