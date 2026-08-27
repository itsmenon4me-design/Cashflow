// IDR-only application: every ledger, account, and preference is Rupiah.
// The single-currency decision is final — do not reintroduce multi-currency.
export interface CurrencySpec {
  code: string;
  minorUnits: number;
  primaryLocale: string;
  symbol?: string;
  hasMinorUnits?: boolean;
}

export const FIXED_CURRENCY = 'IDR' as const;

export const CURRENCY_SPECS: Record<string, CurrencySpec> = {
  IDR: { code: 'IDR', minorUnits: 0, primaryLocale: 'id-ID', symbol: 'Rp', hasMinorUnits: false },
};

export const DASHBOARD_CURRENCIES = [FIXED_CURRENCY] as const;

export type SupportedCurrency = typeof FIXED_CURRENCY;

export const SUPPORTED_CURRENCIES: readonly string[] = [FIXED_CURRENCY];

export function getCurrencySpec(_code?: string): CurrencySpec {
  return CURRENCY_SPECS.IDR;
}
