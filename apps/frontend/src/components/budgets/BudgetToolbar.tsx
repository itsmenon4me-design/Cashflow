"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

interface BudgetToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
}

export function BudgetToolbar({ count, onAdd }: BudgetToolbarProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {uiText.budgets.count.replace("{count}", String(count))}
      </p>
      <Button type="button" className="w-fit rounded-xl" onClick={onAdd}>
        <Plus />
        {uiText.budgets.add}
      </Button>
    </div>
  );
}