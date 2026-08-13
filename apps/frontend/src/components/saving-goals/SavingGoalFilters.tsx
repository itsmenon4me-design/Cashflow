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
  SAVING_GOAL_SORT_OPTIONS,
  STATUS_OPTIONS,
} from "@/features/saving-goals/constants";
import type { SavingGoalFiltersState } from "@/features/saving-goals/types";
import { uiText } from "@/locales";

interface SavingGoalFiltersProps {
  filters: SavingGoalFiltersState;
  onChange: (filters: SavingGoalFiltersState) => void;
  onReset: () => void;
}

export function SavingGoalFilters({ filters, onChange, onReset }: SavingGoalFiltersProps) {
  const update = (patch: Partial<SavingGoalFiltersState>) =>
    onChange({ ...filters, ...patch });

  return (
    <Card className="shadow-sm">
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl bg-card pl-9"
            placeholder={uiText.savingGoals.searchPlaceholder}
            aria-label={uiText.savingGoals.searchPlaceholder}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(status) =>
            update({ status: status as SavingGoalFiltersState["status"] })
          }
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue placeholder={uiText.savingGoals.statusAll} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          onValueChange={(sort) => update({ sort: sort as SavingGoalFiltersState["sort"] })}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue placeholder={uiText.savingGoals.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            {SAVING_GOAL_SORT_OPTIONS.map((option) => (
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