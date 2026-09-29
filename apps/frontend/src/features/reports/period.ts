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

const DEFAULT_TIMEZONE = "Asia/Jakarta";

export function normalizeTimezone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function dateParts(date: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return { year: values.year, month: values.month, day: values.day };
}

function zonedStart(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const values: Record<string, number> = {};
    for (const part of new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate))) {
      if (part.type !== "literal") values[part.type] = Number(part.value);
    }
    const represented = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );
    const correction = target - represented;
    if (correction === 0) return new Date(candidate);
    candidate += correction;
  }
  return new Date(candidate);
}

function startOfDay(date: Date, timeZone: string): Date {
  const parts = dateParts(date, timeZone);
  return zonedStart(parts.year, parts.month, parts.day, timeZone);
}

function endOfDay(date: Date, timeZone: string): Date {
  const parts = dateParts(date, timeZone);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return new Date(
    zonedStart(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      timeZone,
    ).getTime() - 1,
  );
}

function monthStart(year: number, month: number, timeZone: string): Date {
  return zonedStart(year, month, 1, timeZone);
}

function monthEnd(year: number, month: number, timeZone: string): Date {
  const next = new Date(Date.UTC(year, month, 1));
  return new Date(
    zonedStart(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      1,
      timeZone,
    ).getTime() - 1,
  );
}

function addMonths(
  parts: { year: number; month: number; day: number },
  amount: number,
): { year: number; month: number; day: number } {
  const target = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: Math.min(parts.day, lastDay),
  };
}

export function dateInputRange(
  startDate: string,
  endDate: string,
  timeZone = DEFAULT_TIMEZONE,
): ReportRange | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    return null;
  }
  const zone = normalizeTimezone(timeZone);
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const startCalendarDate = new Date(
    Date.UTC(startYear, startMonth - 1, startDay),
  );
  const endCalendarDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  if (
    startCalendarDate.getUTCFullYear() !== startYear ||
    startCalendarDate.getUTCMonth() + 1 !== startMonth ||
    startCalendarDate.getUTCDate() !== startDay ||
    endCalendarDate.getUTCFullYear() !== endYear ||
    endCalendarDate.getUTCMonth() + 1 !== endMonth ||
    endCalendarDate.getUTCDate() !== endDay ||
    startDate > endDate
  ) {
    return null;
  }
  const start = zonedStart(startYear, startMonth, startDay, zone);
  const endExclusive = zonedStart(endYear, endMonth, endDay + 1, zone);
  if (Number.isNaN(start.getTime()) || start >= endExclusive) return null;
  return {
    startDate: start.toISOString(),
    endDate: new Date(endExclusive.getTime() - 1).toISOString(),
  };
}

export function computeRange(
  key: PeriodKey,
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): ReportRange {
  const zone = normalizeTimezone(timeZone);
  const today = dateParts(now, zone);

  switch (key) {
    case "thisMonth":
      return {
        startDate: monthStart(today.year, today.month, zone).toISOString(),
        endDate: monthEnd(today.year, today.month, zone).toISOString(),
      };
    case "lastMonth": {
      const previous = addMonths({ ...today, day: 1 }, -1);
      return {
        startDate: monthStart(
          previous.year,
          previous.month,
          zone,
        ).toISOString(),
        endDate: monthEnd(previous.year, previous.month, zone).toISOString(),
      };
    }
    case "threeMonths":
    case "sixMonths": {
      const start = addMonths(today, key === "threeMonths" ? -3 : -6);
      return {
        startDate: startOfDay(
          zonedStart(start.year, start.month, start.day, zone),
          zone,
        ).toISOString(),
        endDate: endOfDay(now, zone).toISOString(),
      };
    }
    case "thisYear":
      return {
        startDate: monthStart(today.year, 1, zone).toISOString(),
        endDate: endOfDay(now, zone).toISOString(),
      };
    case "custom": {
      const start = startOfDay(now, zone);
      return {
        startDate: start.toISOString(),
        endDate: endOfDay(now, zone).toISOString(),
      };
    }
  }
}

export function previousRange(
  range: ReportRange,
  timeZone = DEFAULT_TIMEZONE,
): ReportRange {
  const zone = normalizeTimezone(timeZone);
  const end = new Date(range.endDate);
  const start = new Date(range.startDate);
  const localStart = dateParts(start, zone);
  const fullMonthStart = monthStart(localStart.year, localStart.month, zone);
  const fullMonthEnd = monthEnd(localStart.year, localStart.month, zone);

  if (
    start.getTime() === fullMonthStart.getTime() &&
    end.getTime() === fullMonthEnd.getTime()
  ) {
    const previous = addMonths({ ...localStart, day: 1 }, -1);
    return {
      startDate: monthStart(previous.year, previous.month, zone).toISOString(),
      endDate: new Date(fullMonthStart.getTime() - 1).toISOString(),
    };
  }

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

export function pickTrendType(
  range: ReportRange,
): "daily" | "weekly" | "monthly" {
  const days = rangeDays(range);
  if (days <= 45) return "daily";
  if (days <= 200) return "weekly";
  return "monthly";
}
