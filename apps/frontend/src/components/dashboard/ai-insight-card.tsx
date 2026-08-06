import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uiText } from "@/locales";

interface AIInsightCardProps {
  items: string[];
}

export function AIInsightCard({ items }: AIInsightCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{uiText.dashboard.aiInsight}</CardTitle>
        <Sparkles className="size-4 text-primary" />
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((insight) => (
          <div
            key={insight}
            className="rounded-xl bg-muted px-3 py-3 text-sm leading-relaxed text-muted-foreground"
          >
            {insight}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
