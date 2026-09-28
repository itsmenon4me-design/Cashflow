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
import { CATEGORY_SORT_OPTIONS } from "@/features/categories/constants";
import type { CategoryFiltersState } from "@/features/categories/types";
import { uiText } from "@/locales";

interface CategoryFiltersProps {
  filters: CategoryFiltersState;
  onChange: (filters: CategoryFiltersState) => void;
  onReset: () => void;
}

export function CategoryFilters({ filters, onChange, onReset }: CategoryFiltersProps) {
  const update = (patch: Partial<CategoryFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(9rem,0.6fr)_minmax(9rem,0.6fr)_auto]">
        <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl border-zinc-500 bg-card pl-9 dark:border-zinc-500"
            placeholder={uiText.categories.searchPlaceholder}
            aria-label={uiText.categories.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.type}
          onValueChange={(type) =>
            update({ type: type as CategoryFiltersState["type"] })
          }
        >
          <SelectTrigger
            className="w-full rounded-xl border-zinc-500 dark:border-zinc-500"
            aria-label={uiText.categories.filterType}
          >
            <SelectValue placeholder={uiText.categories.filterType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.categories.allTypes}</SelectItem>
            <SelectItem value="INCOME">{uiText.transactions.typeIncome}</SelectItem>
            <SelectItem value="EXPENSE">{uiText.transactions.typeExpense}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as CategoryFiltersState["sort"] })}
        >
          <SelectTrigger
            className="w-full rounded-xl border-zinc-500 dark:border-zinc-500"
            aria-label={uiText.categories.sortLabel}
          >
            <SelectValue placeholder={uiText.categories.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-zinc-500 dark:border-zinc-500"
          onClick={onReset}
        >
          <RotateCcw />
          {uiText.transactions.resetFilters}
        </Button>
      </CardContent>
    </Card>
  );
}