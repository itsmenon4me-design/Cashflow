export type ThemePreference = "light" | "dark";
export type LanguagePreference = "id" | "en";

export interface NotificationPreferences {
  transactions: boolean;
  budgets: boolean;
  savingGoals: boolean;
  accounts: boolean;
  investments: boolean;
  system: boolean;
}

export interface FinanceBotSettings {
  enabled: boolean;
  personality: "SANTAI" | "TEGAS" | "SAVAGE" | "CUSTOM";
  customStyle?: string | null;
  budgetThreshold?: number; // percent, e.g., 80
  dailyReminderEnabled?: boolean;
  reminderTime1?: string | null; // HH:mm
  reminderTime2?: string | null; // HH:mm
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: ThemePreference;
  language: LanguagePreference;
  currency: string;
  timezone: string | null;
  notificationPreferences: NotificationPreferences;
  financeBotSettings?: FinanceBotSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettingsPatch {
  theme?: ThemePreference;
  language?: LanguagePreference;
  currency?: string;
  timezone?: string | null;
  notificationPreferences?: Partial<NotificationPreferences>;
  financeBotSettings?: Partial<FinanceBotSettings> | null;
}

import { SUPPORTED_CURRENCIES } from "@/lib/money";

export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES;