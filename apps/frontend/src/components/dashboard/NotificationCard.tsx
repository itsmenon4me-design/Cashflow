import { Bell, CalendarClock, PiggyBank, TrendingUp, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uiText } from "@/locales";
import type { NotificationItem, NotificationType } from "@/types/dashboard";

const notificationConfig: Record<
  NotificationType,
  { label: string; icon: LucideIcon; iconClassName: string; badgeClassName: string }
> = {
  bill: {
    label: uiText.notification.bill,
    icon: CalendarClock,
    iconClassName: "bg-amber-500/10 text-amber-500",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  goal: {
    label: uiText.notification.goal,
    icon: PiggyBank,
    iconClassName: "bg-primary/10 text-primary",
    badgeClassName: "border-primary/30 bg-primary/10 text-primary",
  },
  income: {
    label: uiText.notification.income,
    icon: TrendingUp,
    iconClassName: "bg-emerald-500/10 text-emerald-500",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
};

interface NotificationCardProps {
  items: NotificationItem[];
}

export function NotificationCard({ items }: NotificationCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{uiText.navigation.notifications}</CardTitle>
        <Bell className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const config = notificationConfig[item.type];
          const Icon = config.icon;

          return (
            <div key={item.id} className="flex items-start gap-3 rounded-xl bg-muted p-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  config.iconClassName
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
              </div>
              <Badge variant="outline" className={cn("shrink-0 rounded-lg", config.badgeClassName)}>
                {config.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
