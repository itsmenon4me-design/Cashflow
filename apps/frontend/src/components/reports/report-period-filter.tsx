"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_KEYS, type PeriodKey, type ReportRange } from "@/features/reports/period";
import { formatTransactionDate } from "@/lib/format";
import { uiText } from "@/locales";

interface ReportPeriodFilterProps {
  value: PeriodKey;
  range: ReportRange;
  loading?: boolean;
  customStart: string;
  customEnd: string;
  onPeriodChange: (key: PeriodKey) => void;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onApplyCustom: () => void;
}

export function ReportPeriodFilter({
  value,
  range,
  loading = false,
  customStart,
  customEnd,
  onPeriodChange,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
}: ReportPeriodFilterProps) {
  const rangeLabel = `${formatTransactionDate(range.startDate)} – ${formatTransactionDate(
    range.endDate
  )}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-period-select" className="text-xs text-muted-foreground">
            {uiText.reports.periodLabel}
          </Label>
          <Select value={value} onValueChange={(v) => onPeriodChange(v as PeriodKey)}>
            <SelectTrigger id="report-period-select" className="w-full sm:w-48" disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {uiText.reports[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="report-start" className="text-xs text-muted-foreground">
                {uiText.reports.startDate}
              </Label>
              <Input
                id="report-start"
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
                disabled={loading}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-end" className="text-xs text-muted-foreground">
                {uiText.reports.endDate}
              </Label>
              <Input
                id="report-end"
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
                disabled={loading}
                className="h-9"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onApplyCustom}
              disabled={loading}
              className="rounded-xl"
            >
              {uiText.reports.apply}
            </Button>
          </>
        )}

        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>
    </div>
  );
}