import { uiText } from "@/locales";

export function formatRelativeTime(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const diff = Date.now() - parsed.getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) {
    return uiText.time.justNow;
  }
  if (diff < hour) {
    return uiText.time.minutesAgo.replace("{n}", String(Math.floor(diff / minute)));
  }
  if (diff < day) {
    return uiText.time.hoursAgo.replace("{n}", String(Math.floor(diff / hour)));
  }
  if (diff < 2 * day) {
    return uiText.time.yesterday;
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}