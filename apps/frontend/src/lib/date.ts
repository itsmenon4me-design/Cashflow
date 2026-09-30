/**
 * Local date/time <-> UTC ISO helpers for transaction timestamps.
 *
 * Rules (best practice):
 * - Users input date + time in their local timezone (default WIB/Asia/Jakarta).
 * - The database stores the exact UTC instant (ISO string with Z).
 * - Display converts the UTC instant back to the user's local timezone.
 */

/** Format a Date as a local YYYY-MM-DD input value. */
export function toInputDate(date: Date, timeZone?: string): string {
  if (timeZone) {
    const { year, month, day } = dateTimePartsInTimezone(date, timeZone);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function dateTimePartsInTimezone(
  date: Date,
  timeZone: string,
): Record<string, number> {
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
  }).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values;
}

function localDateTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = target;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const values = dateTimePartsInTimezone(new Date(candidate), timeZone);
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

/** Format a local YYYY-MM-DD input value for display. */
export function formatInputDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Current local time as HH:mm input value. */
export function currentLocalTime(timeZone?: string): string {
  const now = new Date();
  if (timeZone) {
    const { hour, minute } = dateTimePartsInTimezone(now, timeZone);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Convert a local date ("YYYY-MM-DD") + time ("HH:mm") input to a UTC ISO string.
 * A date-time without an offset is interpreted by JS as *local* time, so the
 * resulting ISO string is the exact UTC instant of what the user typed.
 * Missing time falls back to 00:00 (start of the local day).
 */
export function inputDateTimeToIso(
  date: string,
  time?: string,
  timeZone?: string,
): string {
  const cleanTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return (
    timeZone
      ? localDateTimeToInstant(date, `${cleanTime}:00`, timeZone)
      : new Date(`${date}T${cleanTime}:00`)
  ).toISOString();
}

/** Extract the local HH:mm part of an ISO instant (UTC in, local display out). */
export function isoToLocalTime(iso: string, timeZone?: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "00:00";
  }
  if (timeZone) {
    const { hour, minute } = dateTimePartsInTimezone(parsed, timeZone);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD of an ISO instant (for date-only inputs). */
export function isoToInputDate(iso: string, timeZone?: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  if (timeZone) {
    const { year, month, day } = dateTimePartsInTimezone(parsed, timeZone);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return toInputDate(parsed);
}

/** ISO start of the local day for the given date input ("YYYY-MM-DD"). */
export function inputDateToStartIso(date: string, timeZone?: string): string {
  return inputDateTimeToIso(date, "00:00", timeZone);
}

/** ISO end of the local day (23:59:59.999) for the given date input. */
export function inputDateToEndIso(date: string, timeZone?: string): string {
  if (!timeZone) return new Date(`${date}T23:59:59.999`).toISOString();
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return new Date(
    localDateTimeToInstant(
      nextDate.toISOString().slice(0, 10),
      "00:00:00",
      timeZone,
    ).getTime() - 1,
  ).toISOString();
}