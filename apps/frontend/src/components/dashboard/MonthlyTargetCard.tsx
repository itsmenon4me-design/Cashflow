import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { getPercentage, getRemaining } from "@/lib/progress";
import { uiText } from "@/locales";
import type { MonthlyTargetItem } from "@/types/dashboard";

interface MonthlyTargetCardProps {
  items: MonthlyTargetItem[];
}

export function MonthlyTargetCard({ items }: MonthlyTargetCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{uiText.dashboard.monthlyTarget}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item) => {
          const percentage = getPercentage(item.realized, item.target);
          const remaining = getRemaining(item.realized, item.target);

          return (
            <div key={item.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="font-semibold text-primary">{percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="space-y-1 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{uiText.dashboard.targetMonth}</span>
                  <span className="font-medium text-foreground">{formatCurrency(item.target)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{uiText.dashboard.realized}</span>
                  <span className="font-medium text-emerald-500">{formatCurrency(item.realized)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{uiText.dashboard.remaining}</span>
                  <span className="font-medium text-foreground">{formatCurrency(remaining)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
