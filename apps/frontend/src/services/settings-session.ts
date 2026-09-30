import { settingsService } from "@/services/settings.service";
import type { UserSettings } from "@/types/settings";

const settingsRequests = new Map<string, Promise<UserSettings>>();
let timezoneSyncAttemptedFor: string | null = null;

export function getSettingsForSession(
  sessionKey: string,
): Promise<UserSettings> {
  const existing = settingsRequests.get(sessionKey);
  if (existing) return existing;

  const request = settingsService.getSettings();
  settingsRequests.set(sessionKey, request);
  void request.catch(() => {
    if (settingsRequests.get(sessionKey) === request) {
      settingsRequests.delete(sessionKey);
    }
  });
  return request;
}

export function setSettingsForSession(
  sessionKey: string,
  settings: UserSettings,
): void {
  settingsRequests.set(sessionKey, Promise.resolve(settings));
}

export function markTimezoneSyncAttempt(sessionKey: string): boolean {
  if (timezoneSyncAttemptedFor === sessionKey) return false;
  timezoneSyncAttemptedFor = sessionKey;
  return true;
}

export function clearSettingsSession(sessionKey?: string): void {
  if (sessionKey) settingsRequests.delete(sessionKey);
  else settingsRequests.clear();

  if (!sessionKey || timezoneSyncAttemptedFor === sessionKey) {
    timezoneSyncAttemptedFor = null;
  }
}
