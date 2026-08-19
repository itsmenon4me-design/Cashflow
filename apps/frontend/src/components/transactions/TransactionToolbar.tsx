"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";

interface TransactionToolbarProps {
  count?: number;
  loading?: boolean;
  onAdd?: () => void;
  showAdd?: boolean;
}

export function TransactionToolbar({
  count,
  loading = false,
  onAdd,
  showAdd = true,
}: TransactionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {loading ? (
        <Skeleton className="h-5 w-32" />
      ) : typeof count === "number" ? (
        <p className="text-sm text-muted-foreground">
          {uiText.transactions.count.replace("{count}", String(count))}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {showAdd && (
          <Button type="button" className="rounded-xl" onClick={onAdd}>
            <Plus />
            {uiText.transactions.add}
          </Button>
        )}
      </div>
    </div>
  );
}
