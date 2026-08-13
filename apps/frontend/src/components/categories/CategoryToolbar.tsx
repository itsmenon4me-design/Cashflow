"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";

interface CategoryToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
}

export function CategoryToolbar({ count, loading = false, onAdd }: CategoryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {loading ? (
        <Skeleton className="h-5 w-32" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {uiText.categories.count.replace("{count}", String(count))}
        </p>
      )}
      <Button type="button" className="rounded-xl" onClick={onAdd}>
        <Plus />
        {uiText.categories.add}
      </Button>
    </div>
  );
}