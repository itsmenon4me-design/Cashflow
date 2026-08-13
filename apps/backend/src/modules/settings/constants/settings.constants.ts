export const THEMES = ['light', 'dark'] as const;
export type ThemePreference = (typeof THEMES)[number];

export const LANGUAGES = ['id', 'en'] as const;
export type LanguagePreference = (typeof LANGUAGES)[number];

export const CURRENCIES = ['IDR', 'USD', 'SGD', 'EUR'] as const;
export type CurrencyPreference = (typeof CURRENCIES)[number];

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<string, boolean> = {
  transactions: true,
  budgets: true,
  savingGoals: true,
  accounts: true,
  investments: true,
  system: true,
};
