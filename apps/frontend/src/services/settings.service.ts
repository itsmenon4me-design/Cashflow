import { apiClient } from "@/lib/axios";
import type {
  ThemePreference,
  LanguagePreference,
  NotificationPreferences,
  UserSettings,
  UserSettingsPatch,
} from "@/types/settings";

interface UserSettingsDTO {
  id: string;
  user_id: string;
  theme: ThemePreference;
  language: LanguagePreference;
  currency: string;
  timezone: string | null;
  notification_preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function toNotificationPreferences(raw: Record<string, unknown> | null): NotificationPreferences {
  const fallback: NotificationPreferences = {
    transactions: true,
    budgets: true,
    savingGoals: true,
    accounts: true,
    investments: true,
    system: true,
  };
  const source = raw ?? {};
  for (const key of Object.keys(fallback) as (keyof NotificationPreferences)[]) {
    if (typeof source[key] === "boolean") {
      fallback[key] = source[key] as boolean;
    }
  }
  return fallback;
}

function normalizeTheme(theme: string): ThemePreference {
  return theme === "light" || theme === "dark" ? theme : "dark";
}

function toUserSettings(dto: UserSettingsDTO): UserSettings {
  const notificationPrefs = toNotificationPreferences(dto.notification_preferences);
  // extract financeBot settings if present under notification_preferences.financeBot
  let financeBotSettings: UserSettings['financeBotSettings'] = undefined;
  try {
    const raw = (dto.notification_preferences as unknown) ?? null;
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const fbRaw = obj['financeBot'];
      if (fbRaw && typeof fbRaw === 'object') {
        const fb = fbRaw as Record<string, unknown>;
        financeBotSettings = {
          enabled: Boolean(fb.enabled),
          personality:
            fb.personality === 'TEGAS' || fb.personality === 'SAVAGE' || fb.personality === 'CUSTOM'
              ? (fb.personality as 'TEGAS' | 'SAVAGE' | 'CUSTOM')
              : 'SANTAI',
          customStyle: typeof fb.customStyle === 'string' ? fb.customStyle : undefined,
          budgetThreshold: typeof fb.budgetThreshold === 'number' ? fb.budgetThreshold : undefined,
          dailyReminderEnabled: typeof fb.dailyReminderEnabled === 'boolean' ? fb.dailyReminderEnabled : undefined,
          reminderTime1: typeof fb.reminderTime1 === 'string' ? fb.reminderTime1 : undefined,
          reminderTime2: typeof fb.reminderTime2 === 'string' ? fb.reminderTime2 : undefined,
        };
      }
    }
  } catch {
    // ignore parsing errors
  }

  return {
    id: dto.id,
    userId: dto.user_id,
    theme: normalizeTheme(dto.theme),
    language: dto.language,
    timezone: dto.timezone,
    notificationPreferences: notificationPrefs,
    financeBotSettings,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export const settingsService = {
  getSettings: async (): Promise<UserSettings> => {
    const body = await apiClient.get<{ success: boolean; data: UserSettingsDTO }>(
      "/settings"
    );
    return toUserSettings(body.data);
  },

  updateSettings: async (patch: UserSettingsPatch): Promise<UserSettings> => {
    const payload: Record<string, unknown> = {};
    if (patch.theme !== undefined) payload.theme = patch.theme;
    if (patch.language !== undefined) payload.language = patch.language;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;

    // handle notification preferences + financeBotSettings under notification_preferences
    const notificationPayload: Record<string, unknown> = {};
    if (patch.notificationPreferences !== undefined) {
      Object.assign(notificationPayload, patch.notificationPreferences);
    }
    if (patch.financeBotSettings !== undefined) {
      notificationPayload.financeBot = patch.financeBotSettings;
    }
    if (Object.keys(notificationPayload).length > 0) {
      payload.notification_preferences = notificationPayload;
    }

    const body = await apiClient.patch<{ success: boolean; data: UserSettingsDTO }>(
      "/settings",
      payload
    );
    return toUserSettings(body.data);
  },

};