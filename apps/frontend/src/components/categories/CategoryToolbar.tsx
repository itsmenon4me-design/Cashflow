"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/locales";

interface CategoryToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
}

export function CategoryToolbar({ count, loading = false, onAdd }: CategoryToolbarProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      {loading ? (
        <span aria-hidden="true" className="h-4 w-20 rounded-md bg-muted" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {uiText.categories.count.replace("{count}", String(count))}
        </p>
      )}
      <Button type="button" className="w-fit rounded-xl" onClick={onAdd}>
        <Plus />
        {uiText.categories.add}
      </Button>
    </div>
  );
}