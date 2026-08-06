import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { ActivityItem, ActivityStatus } from "@/types/dashboard";

const activityStatusConfig: Record<
  ActivityStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  completed: {
    label: uiText.status.completed,
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    dotClassName: "bg-emerald-500",
  },
  pending: {
    label: uiText.status.pending,
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    dotClassName: "bg-amber-500",
  },
  failed: {
    label: uiText.status.failed,
    badgeClassName: "border-red-500/30 bg-red-500/10 text-red-500",
    dotClassName: "bg-red-500",
  },
};

interface ActivityCardProps {
  items: ActivityItem[];
}

export function ActivityCard({ items }: ActivityCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.dashboard.recentActivities}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {items.map((item, index) => {
            const status = activityStatusConfig[item.status];
            const isLast = index === items.length - 1;

            return (
              <div key={item.id} className="relative flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", status.dotClassName)} />
                  {!isLast && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn("min-w-0 flex-1 pb-5", isLast && "pb-0")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{item.user}</span>
                      <span className="text-muted-foreground"> {item.action}</span>
                    </p>
                    <Badge variant="outline" className={cn("shrink-0 rounded-lg", status.badgeClassName)}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
