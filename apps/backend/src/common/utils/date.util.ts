export const DEFAULT_TIMEZONE_OFFSET_HOURS = 7; // WIB (Asia/Jakarta)

export class DateHelper {
  static now(): Date {
    return new Date();
  }

  static nowIso(): string {
    return new Date().toISOString();
  }

  static yearInTimezone(date = new Date(), offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): number {
    return new Date(date.getTime() + offsetHours * 3600_000).getUTCFullYear();
  }

  static monthInTimezone(date = new Date(), offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): number {
    return new Date(date.getTime() + offsetHours * 3600_000).getUTCMonth() + 1;
  }

  /**
   * Start of day for YYYY-MM-DD or Date object with specified timezone offset in hours (default +7 WIB).
   */
  static startOfDay(dateInput: string | Date, offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): Date {
    let y: number, m: number, d: number;
    if (typeof dateInput === "string") {
      const parts = dateInput.split("T")[0].split("-");
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else {
      const utcMs = dateInput.getTime() + offsetHours * 3600_000;
      const target = new Date(utcMs);
      y = target.getUTCFullYear();
      m = target.getUTCMonth() + 1;
      d = target.getUTCDate();
    }
    return new Date(Date.UTC(y, m - 1, d) - offsetHours * 3600_000);
  }

  /**
   * End of day (23:59:59.999) for YYYY-MM-DD or Date object with specified timezone offset in hours (default +7 WIB).
   */
  static endOfDay(dateInput: string | Date, offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): Date {
    let y: number, m: number, d: number;
    if (typeof dateInput === "string") {
      const parts = dateInput.split("T")[0].split("-");
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else {
      const utcMs = dateInput.getTime() + offsetHours * 3600_000;
      const target = new Date(utcMs);
      y = target.getUTCFullYear();
      m = target.getUTCMonth() + 1;
      d = target.getUTCDate();
    }
    return new Date(Date.UTC(y, m - 1, d + 1) - offsetHours * 3600_000 - 1);
  }

  /**
   * Start of month for year & month (1-12) or Date object with specified timezone offset (default +7 WIB).
   */
  static startOfMonth(yearOrDate?: number | Date, month?: number, offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): Date {
    let y: number, m: number;
    if (typeof yearOrDate === "number" && typeof month === "number") {
      y = yearOrDate;
      m = month;
    } else {
      const base = yearOrDate instanceof Date ? yearOrDate : new Date();
      const utcMs = base.getTime() + offsetHours * 3600_000;
      const target = new Date(utcMs);
      y = target.getUTCFullYear();
      m = target.getUTCMonth() + 1;
    }
    return new Date(Date.UTC(y, m - 1, 1) - offsetHours * 3600_000);
  }

  /**
   * End of month (last day 23:59:59.999) for year & month (1-12) or Date object with specified timezone offset (default +7 WIB).
   */
  static endOfMonth(yearOrDate?: number | Date, month?: number, offsetHours = DEFAULT_TIMEZONE_OFFSET_HOURS): Date {
    let y: number, m: number;
    if (typeof yearOrDate === "number" && typeof month === "number") {
      y = yearOrDate;
      m = month;
    } else {
      const base = yearOrDate instanceof Date ? yearOrDate : new Date();
      const utcMs = base.getTime() + offsetHours * 3600_000;
      const target = new Date(utcMs);
      y = target.getUTCFullYear();
      m = target.getUTCMonth() + 1;
    }
    return new Date(Date.UTC(y, m, 1) - offsetHours * 3600_000 - 1);
  }

  static yearInNamedTimezone(date: Date, timeZone: string): number {
    return this.datePartsInTimezone(date, timeZone).year;
  }

  static monthInNamedTimezone(date: Date, timeZone: string): number {
    return this.datePartsInTimezone(date, timeZone).month;
  }

  static calendarDateInTimezone(date: Date, timeZone: string): Date {
    const { year, month, day } = this.datePartsInTimezone(date, timeZone);
    return new Date(Date.UTC(year, month - 1, day));
  }

  static startOfDayInTimezone(dateInput: string | Date, timeZone: string): Date {
    const parts =
      typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
        ? this.parseDateParts(dateInput)
        : this.datePartsInTimezone(
            typeof dateInput === "string" ? new Date(dateInput) : dateInput,
            timeZone,
          );
    return this.instantForLocalDateTime(
      parts.year,
      parts.month,
      parts.day,
      timeZone,
    );
  }

  static endOfDayInTimezone(dateInput: string | Date, timeZone: string): Date {
    const parts =
      typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
        ? this.parseDateParts(dateInput)
        : this.datePartsInTimezone(
            typeof dateInput === "string" ? new Date(dateInput) : dateInput,
            timeZone,
          );
    const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
    return new Date(
      this.instantForLocalDateTime(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth() + 1,
        nextDay.getUTCDate(),
        timeZone,
      ).getTime() - 1,
    );
  }

  static startOfMonthInTimezone(date: Date, timeZone: string): Date {
    const { year, month } = this.datePartsInTimezone(date, timeZone);
    return this.instantForLocalDateTime(year, month, 1, timeZone);
  }

  static startOfNextMonthInTimezone(date: Date, timeZone: string): Date {
    const { year, month } = this.datePartsInTimezone(date, timeZone);
    const nextMonth = new Date(Date.UTC(year, month, 1));
    return this.instantForLocalDateTime(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth() + 1,
      1,
      timeZone,
    );
  }

  static startOfCalendarMonthInTimezone(
    year: number,
    month: number,
    timeZone: string,
  ): Date {
    return this.instantForLocalDateTime(year, month, 1, timeZone);
  }

  static endOfMonthInTimezone(date: Date, timeZone: string): Date {
    const { year, month } = this.datePartsInTimezone(date, timeZone);
    return this.endOfCalendarMonthInTimezone(year, month, timeZone);
  }

  static endOfCalendarMonthInTimezone(
    year: number,
    month: number,
    timeZone: string,
  ): Date {
    const nextMonth = new Date(Date.UTC(year, month, 1));
    return new Date(
      this.instantForLocalDateTime(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth() + 1,
        1,
        timeZone,
      ).getTime() - 1,
    );
  }

  static previousPeriodInTimezone(
    start: Date,
    end: Date,
    timeZone: string,
  ): { start: Date; end: Date } {
    const monthStart = this.startOfMonthInTimezone(start, timeZone);
    const monthEnd = this.endOfMonthInTimezone(start, timeZone);
    if (
      start.getTime() === monthStart.getTime() &&
      end.getTime() === monthEnd.getTime()
    ) {
      const { year, month } = this.datePartsInTimezone(start, timeZone);
      const previousStart = this.startOfCalendarMonthInTimezone(
        year,
        month - 1,
        timeZone,
      );
      return {
        start: previousStart,
        end: new Date(monthStart.getTime() - 1),
      };
    }

    const previousEnd = new Date(start.getTime() - 1);
    return {
      start: new Date(previousEnd.getTime() - (end.getTime() - start.getTime())),
      end: previousEnd,
    };
  }

  private static datePartsInTimezone(
    date: Date,
    timeZone: string,
  ): { year: number; month: number; day: number } {
    const values: Record<string, number> = {};
    for (const part of new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)) {
      if (part.type !== "literal") values[part.type] = Number(part.value);
    }
    return {
      year: values.year,
      month: values.month,
      day: values.day,
    };
  }

  private static parseDateParts(
    date: string,
  ): { year: number; month: number; day: number } {
    const [year, month, day] = date.split("-").map(Number);
    return { year, month, day };
  }

  private static instantForLocalDateTime(
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
}
