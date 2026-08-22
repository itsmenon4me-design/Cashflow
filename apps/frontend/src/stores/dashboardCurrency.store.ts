import { create } from "zustand";
import { normalizeDashboardCurrency, DASHBOARD_CURRENCIES } from "@/lib/dashboard-currency";

interface DashboardCurrencyState {
  currency: (typeof DASHBOARD_CURRENCIES)[number];
  hydrated: boolean;
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
  useDashboardCurrencyStore.setState({
    currency: nextCurrency,
    hydrated: true,
  });
  return nextCurrency;
}

function writeStoredCurrency(currency: (typeof DASHBOARD_CURRENCIES)[number]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
    window.sessionStorage.removeItem(STORAGE_KEY);
    try { console.log('[dashboardCurrency.store] wrote storage', STORAGE_KEY, window.localStorage.getItem(STORAGE_KEY)); } catch (e) {}
  } catch {}
}

export const useDashboardCurrencyStore = create<DashboardCurrencyState>((set) => ({
  // Initialize to DEFAULT_CURRENCY on module load so server and client initial render match.
  // Actual stored value is applied during hydrateDashboardCurrency() on mount.
  currency: DEFAULT_CURRENCY,
  hydrated: false,
  setCurrency: (c: string) => {
    const norm = normalizeDashboardCurrency(c) ?? DEFAULT_CURRENCY;
    writeStoredCurrency(norm);
    set({ currency: norm, hydrated: true });
  },
}));

export const DASHBOARD_CURRENCY_STORAGE_KEY = STORAGE_KEY;
