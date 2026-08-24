"use client";

import { useEffect, useState } from "react";
import { Check, Cloud, CloudOff, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncStore, type SyncUiStatus } from "@/stores/sync.store";

const CONFIG: Record<
  SyncUiStatus,
  { label: string; Icon: LucideIcon; iconClassName: string }
> = {
  online: { label: "Online", Icon: Cloud, iconClassName: "text-muted-foreground" },
  offline: { label: "Offline", Icon: CloudOff, iconClassName: "text-warning" },
  syncing: { label: "Syncing", Icon: Cloud, iconClassName: "text-info" },
  synced: { label: "Synced", Icon: Check, iconClassName: "text-success" },
  "sync-failed": {
    label: "Sync failed",
    Icon: TriangleAlert,
    iconClassName: "text-destructive",
  },
};

const PILL_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground";

export function SyncStatusIndicator({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const status = useSyncStore((state) => state.status);
  const online = useSyncStore((state) => state.online);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reserve the exact pill geometry before mount so hydration never shifts the header.
  if (!mounted) {
    return (
      <div aria-hidden className={cn(PILL_CLASSES, "invisible", className)}>
        <Cloud className="size-3.5 shrink-0" />
        {showLabel && (
          <span className="inline-block min-w-[3.4rem] text-center tabular-nums">
            {CONFIG.online.label}
          </span>
        )}
      </div>
    );
  }

  const resolved: SyncUiStatus = online && status === "online" ? "online" : status;
  const { label, Icon, iconClassName } = CONFIG[resolved];
  const pending =
    (resolved === "syncing" || resolved === "offline") && pendingCount > 0
      ? ` · ${pendingCount}`
      : "";

  return (
    <div
      role="status"
      aria-live="polite"
      title={label}
      className={cn(PILL_CLASSES, className)}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden="true" />
      {/* Fixed-width label: Online/Syncing/Synced share the same slot so the
          header row never re-flows when the status text changes. */}
      {showLabel && (
        <span className="inline-block min-w-[3.4rem] text-center tabular-nums">
          {label + pending}
        </span>
      )}
    </div>
  );
}