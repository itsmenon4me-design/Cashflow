import { create } from "zustand";
import { normalizeDashboardCurrency, DASHBOARD_CURRENCIES } from "@/lib/dashboard-currency";

interface DashboardCurrencyState {
  currency: (typeof DASHBOARD_CURRENCIES)[number];
  setCurrency: (c: string) => void;
}

const STORAGE_KEY = "cashflow-dashboard-currency";
export const DEFAULT_CURRENCY: (typeof DASHBOARD_CURRENCIES)[number] = "USD";

export function readStoredCurrency(): (typeof DASHBOARD_CURRENCIES)[number] {
  if (typeof window === "undefined") {
    return DEFAULT_CURRENCY;
  }

  try {
    const localValue = window.localStorage.getItem(STORAGE_KEY);
    if (localValue) {
      return normalizeDashboardCurrency(localValue) ?? DEFAULT_CURRENCY;
    }

    const sessionValue = window.sessionStorage.getItem(STORAGE_KEY);
    return normalizeDashboardCurrency(sessionValue) ?? DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function hydrateDashboardCurrency(): (typeof DASHBOARD_CURRENCIES)[number] {
  const nextCurrency = readStoredCurrency();
  useDashboardCurrencyStore.setState({ currency: nextCurrency });
  return nextCurrency;
}

function writeStoredCurrency(currency: (typeof DASHBOARD_CURRENCIES)[number]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export const useDashboardCurrencyStore = create<DashboardCurrencyState>((set) => ({
  currency: readStoredCurrency(),
  setCurrency: (c: string) => {
    const norm = normalizeDashboardCurrency(c) ?? DEFAULT_CURRENCY;
    writeStoredCurrency(norm);
    set({ currency: norm });
  },
}));

export const DASHBOARD_CURRENCY_STORAGE_KEY = STORAGE_KEY;
