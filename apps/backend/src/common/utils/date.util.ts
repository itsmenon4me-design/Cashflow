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
}
