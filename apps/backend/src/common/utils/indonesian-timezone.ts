const INDONESIAN_TIMEZONE_ALIASES: Readonly<Record<string, string>> = {
  "Asia/Jakarta": "Asia/Jakarta",
  "Asia/Pontianak": "Asia/Jakarta",
  "Asia/Makassar": "Asia/Makassar",
  "Asia/Ujung_Pandang": "Asia/Makassar",
  "Asia/Jayapura": "Asia/Jayapura",
};

export const ALLOWED_USER_TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
] as const;

export function canonicalIndonesianTimezone(
  timeZone: string | null | undefined,
): string | null {
  return typeof timeZone === "string"
    ? INDONESIAN_TIMEZONE_ALIASES[timeZone] ?? null
    : null;
}

export function isAllowedUserTimezone(value: unknown): boolean {
  return (
    typeof value === "string" &&
    ALLOWED_USER_TIMEZONES.some((timeZone) => timeZone === value)
  );
}
