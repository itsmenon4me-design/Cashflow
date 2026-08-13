export type PeriodKey =
  | "thisMonth"
  | "lastMonth"
  | "threeMonths"
  | "sixMonths"
  | "thisYear"
  | "custom";

export interface ReportRange {
  startDate: string;
  endDate: string;
}

export const PERIOD_KEYS: PeriodKey[] = [
  "thisMonth",
  "lastMonth",
  "threeMonths",
  "sixMonths",
  "thisYear",
  "custom",
];

function isoFromDate(d: Date): string {
  return d.toISOString();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function monthStart(year: number, monthZeroBased: number): Date {
  return startOfDay(new Date(year, monthZeroBased, 1));
}

function monthEnd(year: number, monthZeroBased: number): Date {
  return endOfDay(new Date(year, monthZeroBased + 1, 0));
}

function addMonths(d: Date, amount: number): Date {
  const x = new Date(d);
  const targetDay = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + amount);
  const daysInMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(targetDay, daysInMonth));
  return x;
}

export function computeRange(key: PeriodKey, now = new Date()): ReportRange {
  const today = startOfDay(now);

  switch (key) {
    case "thisMonth":
      return {
        startDate: isoFromDate(monthStart(now.getFullYear(), now.getMonth())),
        endDate: isoFromDate(monthEnd(now.getFullYear(), now.getMonth())),
      };
    case "lastMonth": {
      const prev = addMonths(monthStart(now.getFullYear(), now.getMonth()), -1);
      const prevYear = prev.getFullYear();
      const prevMonth = prev.getMonth();
      return {
        startDate: isoFromDate(monthStart(prevYear, prevMonth)),
        endDate: isoFromDate(monthEnd(prevYear, prevMonth)),
      };
    }
    case "threeMonths":
      return {
        startDate: isoFromDate(startOfDay(addMonths(today, -3))),
        endDate: isoFromDate(endOfDay(today)),
      };
    case "sixMonths":
      return {
        startDate: isoFromDate(startOfDay(addMonths(today, -6))),
        endDate: isoFromDate(endOfDay(today)),
      };
    case "thisYear":
      return {
        startDate: isoFromDate(monthStart(now.getFullYear(), 0)),
        endDate: isoFromDate(endOfDay(today)),
      };
    case "custom":
      return {
        startDate: isoFromDate(startOfDay(today)),
        endDate: isoFromDate(endOfDay(today)),
      };
  }
}

export function previousRange(range: ReportRange): ReportRange {
  const end = new Date(range.endDate);
  const start = new Date(range.startDate);
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return {
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString(),
  };
}

export function rangeDays(range: ReportRange): number {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function pickTrendType(range: ReportRange): "daily" | "weekly" | "monthly" {
  const days = rangeDays(range);
  if (days <= 45) return "daily";
  if (days <= 200) return "weekly";
  return "monthly";
}