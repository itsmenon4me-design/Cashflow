"use client";

import { CloudUpload } from "lucide-react";

import { uiText } from "@/locales";
import { cn } from "@/lib/utils";

/**
 * Visual indicator for optimistic UI: the transaction was created/edited while
 * offline and is queued locally ("pending_sync"), not yet confirmed by server.
 */
export function PendingSyncBadge({ className }: { className?: string }) {
  return (
    <span
      title={uiText.transactions.pendingSyncBadge}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-warning/60 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning",
        className,
      )}
    >
      <CloudUpload className="size-3" aria-hidden="true" />
      {uiText.transactions.pendingSyncBadge}
    </span>
  );
}
