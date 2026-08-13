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
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.categories.searchPlaceholder}
            aria-label={uiText.categories.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as CategoryFiltersState["sort"] })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.categories.sortLabel}>
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

        <Button type="button" variant="outline" className="rounded-xl" onClick={onReset}>
          <RotateCcw />
          {uiText.transactions.resetFilters}
        </Button>
      </CardContent>
    </Card>
  );
}