export interface CurrencySpec {
  code: string;
  minorUnits: number;
  primaryLocale: string;
  /** Optional display symbol (e.g. Rp, $). Not required by frontend formatting but useful server-side */
  symbol?: string;
  /** Optional flag mirroring whether the currency has minor units */
  hasMinorUnits?: boolean;
}

export const CURRENCY_SPECS: Record<string, CurrencySpec> = {
  IDR: { code: 'IDR', minorUnits: 0, primaryLocale: 'id-ID', symbol: 'Rp', hasMinorUnits: false },
  USD: { code: 'USD', minorUnits: 2, primaryLocale: 'en-US', symbol: '$', hasMinorUnits: true },
  SGD: { code: 'SGD', minorUnits: 2, primaryLocale: 'en-SG', symbol: 'S$', hasMinorUnits: true },
  EUR: { code: 'EUR', minorUnits: 2, primaryLocale: 'de-DE', symbol: '€', hasMinorUnits: true },
  JPY: { code: 'JPY', minorUnits: 0, primaryLocale: 'ja-JP', symbol: '¥', hasMinorUnits: false },
  VND: { code: 'VND', minorUnits: 0, primaryLocale: 'vi-VN', symbol: '₫', hasMinorUnits: false },
  MYR: { code: 'MYR', minorUnits: 2, primaryLocale: 'ms-MY', symbol: 'RM', hasMinorUnits: true },
  THB: { code: 'THB', minorUnits: 2, primaryLocale: 'th-TH', symbol: '฿', hasMinorUnits: true },
  PHP: { code: 'PHP', minorUnits: 2, primaryLocale: 'fil-PH', symbol: '₱', hasMinorUnits: true },
  GBP: { code: 'GBP', minorUnits: 2, primaryLocale: 'en-GB', symbol: '£', hasMinorUnits: true },
  AUD: { code: 'AUD', minorUnits: 2, primaryLocale: 'en-AU', symbol: 'A$', hasMinorUnits: true },
  CNY: { code: 'CNY', minorUnits: 2, primaryLocale: 'zh-CN', symbol: '¥', hasMinorUnits: true },
  HKD: { code: 'HKD', minorUnits: 2, primaryLocale: 'zh-HK', symbol: 'HK$', hasMinorUnits: true },
};

export const DASHBOARD_CURRENCIES = [
  'IDR',
  'USD',
  'SGD',
  'EUR',
  'JPY',
  'VND',
  'MYR',
  'THB',
  'PHP',
  'GBP',
  'AUD',
  'CNY',
  'HKD',
] as const;

export type SupportedCurrency = (typeof DASHBOARD_CURRENCIES)[number];

export const SUPPORTED_CURRENCIES: readonly string[] = Object.keys(CURRENCY_SPECS);

export function getCurrencySpec(code: string | undefined): CurrencySpec {
  if (!code) {
    return CURRENCY_SPECS.IDR;
  }
  const spec = CURRENCY_SPECS[code.toUpperCase()];
  if (!spec) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return spec;
}
