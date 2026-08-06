import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  contentClassName?: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  actions,
  loading = false,
  empty = false,
  contentClassName,
  className,
  children,
}: ChartCardProps) {
  const showEmpty = !loading && empty;

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        <div className={cn("h-72", contentClassName)}>
          {loading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : showEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Inbox className="size-8" />
              <p className="text-sm">{uiText.common.noDataAvailable}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
}
