import { create } from "zustand";

export const FIXED_CURRENCY = "IDR";

interface DashboardCurrencyState {
  currency: typeof FIXED_CURRENCY;
  hydrated: boolean;
  setCurrency: (c: string) => void;
}

const store = create<DashboardCurrencyState>(() => ({
  currency: FIXED_CURRENCY,
  hydrated: true,
  setCurrency: () => {},
}));

export const useDashboardCurrencyStore = store;

export function hydrateDashboardCurrency(): void {}
export async function syncDashboardCurrencyFromServer(): Promise<void> {}
