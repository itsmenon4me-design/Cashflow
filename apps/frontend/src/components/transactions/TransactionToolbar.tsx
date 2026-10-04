"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

interface TransactionToolbarProps {
  count?: number;
  loading?: boolean;
  onAdd?: () => void;
  showAdd?: boolean;
  showCount?: boolean;
}

export function TransactionToolbar({
  count,
  loading = false,
  onAdd,
  showAdd = true,
  showCount = true,
}: TransactionToolbarProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      {showCount && !loading && typeof count === "number" ? (
        <p className="text-sm text-muted-foreground">
          {uiText.transactions.count.replace("{count}", String(count))}
        </p>
      ) : null}
      <div className="ml-auto flex items-center justify-end gap-2">
        {showAdd && (
          <Button type="button" className="w-fit rounded-xl" onClick={onAdd}>
            <Plus />
            {uiText.transactions.add}
          </Button>
        )}
      </div>
    </div>
  );
}
