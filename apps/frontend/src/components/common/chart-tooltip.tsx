interface ChartTooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  valueFormatter?: (value: number | string) => string;
}

export function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
      {label !== undefined && label !== "" && (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? "var(--primary)" }}
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-medium text-foreground">
              {valueFormatter ? valueFormatter(entry.value ?? "") : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
