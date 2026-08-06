import { XAxis, YAxis } from "recharts";
import { formatCompact } from "@/lib/format";

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

export function ChartYAxis() {
  return (
    <YAxis
      axisLine={false}
      tickLine={false}
      width={56}
      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
      tickFormatter={(value) => formatCompact(Number(value))}
    />
  );
}
