/**
 * Local date/time <-> UTC ISO helpers for transaction timestamps.
 *
 * Rules (best practice):
 * - Users input date + time in their local timezone (default WIB/Asia/Jakarta).
 * - The database stores the exact UTC instant (ISO string with Z).
 * - Display converts the UTC instant back to the user's local timezone.
 */

/** Format a Date as a local YYYY-MM-DD input value. */
export function toInputDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Current local time as HH:mm input value. */
export function currentLocalTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Convert a local date ("YYYY-MM-DD") + time ("HH:mm") input to a UTC ISO string.
 * A date-time without an offset is interpreted by JS as *local* time, so the
 * resulting ISO string is the exact UTC instant of what the user typed.
 * Missing time falls back to 00:00 (start of the local day).
 */
export function inputDateTimeToIso(date: string, time?: string): string {
  const cleanTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${cleanTime}:00`).toISOString();
}

/** Extract the local HH:mm part of an ISO instant (UTC in, local display out). */
export function isoToLocalTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "00:00";
  }
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD of an ISO instant (for date-only inputs). */
export function isoToInputDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return toInputDate(parsed);
}

/** ISO start of the local day for the given date input ("YYYY-MM-DD"). */
export function inputDateToStartIso(date: string): string {
  return inputDateTimeToIso(date, "00:00");
}

/** ISO end of the local day (23:59:59.999) for the given date input. */
export function inputDateToEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}