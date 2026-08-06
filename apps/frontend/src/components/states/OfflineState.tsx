import { WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OfflineStateProps {
  title?: string;
  description?: string;
  badge?: string;
  className?: string;
}

export function OfflineState({
  title = "Anda sedang offline.",
  description = "Data mungkin tidak terbaru. Periksa koneksi internet Anda.",
  badge = "Sinkronisasi offline akan tersedia",
  className,
}: OfflineStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="neutral">{badge}</Badge>
    </div>
  );
}