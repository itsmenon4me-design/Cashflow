"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";

interface BudgetToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
}

export function BudgetToolbar({ count, loading = false, onAdd }: BudgetToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {loading ? (
        <Skeleton className="h-5 w-32" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {uiText.budgets.count.replace("{count}", String(count))}
        </p>
      )}
      <Button type="button" className="rounded-xl" onClick={onAdd}>
        <Plus />
        {uiText.budgets.add}
      </Button>
    </div>
  );
}