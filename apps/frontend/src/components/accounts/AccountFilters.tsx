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
  ACCOUNT_SORT_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
} from "@/features/accounts/constants";
import type { AccountFiltersState } from "@/features/accounts/types";
import { uiText } from "@/locales";
import type { AccountType } from "@/types/backend";

interface AccountFiltersProps {
  filters: AccountFiltersState;
  onChange: (filters: AccountFiltersState) => void;
  onReset: () => void;
}

export function AccountFilters({ filters, onChange, onReset }: AccountFiltersProps) {
  const update = (patch: Partial<AccountFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.accounts.searchPlaceholder}
            aria-label={uiText.accounts.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.type}
          onValueChange={(type) => update({ type: type as AccountType | "all" })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.accounts.fieldType}>
            <SelectValue placeholder={uiText.common.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uiText.common.allTypes}</SelectItem>
            {ACCOUNT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as AccountFiltersState["sort"] })}
        >
          <SelectTrigger className="w-full rounded-xl" aria-label={uiText.accounts.sortLabel}>
            <SelectValue placeholder={uiText.accounts.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_SORT_OPTIONS.map((option) => (
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