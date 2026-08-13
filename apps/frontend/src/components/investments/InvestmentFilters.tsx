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
  INVESTMENT_SORT_OPTIONS,
  INVESTMENT_STATUS_OPTIONS,
  INVESTMENT_TYPE_OPTIONS,
} from "@/features/investments/constants";
import type { InvestmentFiltersState } from "@/features/investments/types";
import { uiText } from "@/locales";

interface InvestmentFiltersProps {
  filters: InvestmentFiltersState;
  onChange: (filters: InvestmentFiltersState) => void;
  onReset: () => void;
}

export function InvestmentFilters({
  filters,
  onChange,
  onReset,
}: InvestmentFiltersProps) {
  const update = (patch: Partial<InvestmentFiltersState>) =>
    onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.investments.searchPlaceholder}
            aria-label={uiText.investments.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.type}
          onValueChange={(type) => update({ type: type as InvestmentFiltersState["type"] })}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue placeholder={uiText.investments.typeAll} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.investments.typeAll}</SelectItem>
            {INVESTMENT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(status) => update({ status: status as InvestmentFiltersState["status"] })}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue placeholder={uiText.investments.statusAll} />
          </SelectTrigger>
          <SelectContent>
            {INVESTMENT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as InvestmentFiltersState["sort"] })}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue placeholder={uiText.investments.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            {INVESTMENT_SORT_OPTIONS.map((option) => (
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