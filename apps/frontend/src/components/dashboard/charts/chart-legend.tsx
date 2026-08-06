import type { ReactNode } from "react";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--border)",
];

type LegendValue = string | number | Array<string | number>;

export function renderLegendText(value: LegendValue): ReactNode {
  const label = Array.isArray(value) ? value.join(", ") : String(value);
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

interface PieLegendPayload {
  percent?: number;
}

export function renderPieLegend(value: unknown, entry: unknown): ReactNode {
  const payload = (entry as { payload?: PieLegendPayload } | undefined)?.payload;
  const percent = payload?.percent !== undefined ? Math.round(payload.percent * 100) : undefined;
  const label = typeof value === "string" ? value : String(value ?? "");

  return (
    <span className="text-xs text-muted-foreground">
      {label}
      {percent !== undefined && <span className="ml-1 font-medium text-foreground">{percent}%</span>}
    </span>
  );
}
