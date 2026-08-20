import { XAxis, YAxis } from "recharts";
import { formatCompactCurrency } from "@/lib/format";

export function ChartXAxis() {
  return (
    <XAxis
      dataKey="period"
      axisLine={false}
      tickLine={false}
      interval="preserveStartEnd"
      minTickGap={24}
      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
    />
  );
}

export function ChartYAxis({ currency }: { currency?: string }) {
  return (
    <YAxis
      axisLine={false}
      tickLine={false}
      width={56}
      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
      tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
    />
  );
}
