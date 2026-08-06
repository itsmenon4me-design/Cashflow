"use client";

import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/locales";

interface TransactionToolbarProps {
  count: number;
  loading?: boolean;
  onAdd: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function TransactionToolbar({
  count,
  loading = false,
  onAdd,
  onExport,
  onImport,
}: TransactionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {loading ? (
        <Skeleton className="h-5 w-32" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {uiText.transactions.count.replace("{count}", String(count))}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onExport}>
          <Download />
          {uiText.transactions.export}
        </Button>
        <Button type="button" variant="outline" className="rounded-xl" onClick={onImport}>
          <Upload />
          {uiText.transactions.import}
        </Button>
        <Button type="button" className="rounded-xl" onClick={onAdd}>
          <Plus />
          {uiText.transactions.add}
        </Button>
      </div>
    </div>
  );
}
