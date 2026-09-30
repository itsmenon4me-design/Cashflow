import { canonicalIndonesianTimezone } from "../../../backend/src/common/utils/indonesian-timezone";

export const DEFAULT_USER_TIMEZONE = "Asia/Jakarta";

export { canonicalIndonesianTimezone };

export function isValidIanaTimezone(
  timeZone: string | null | undefined,
): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserIndonesianTimezone(): string | null {
  try {
    return canonicalIndonesianTimezone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return null;
  }
}
