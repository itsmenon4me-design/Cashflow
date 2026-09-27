"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

interface SavingGoalToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
}

export function SavingGoalToolbar({ count, onAdd }: SavingGoalToolbarProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {uiText.savingGoals.count.replace("{count}", String(count))}
      </p>
      <Button type="button" className="w-fit rounded-xl" onClick={onAdd}>
        <Plus />
        {uiText.savingGoals.add}
      </Button>
    </div>
  );
}