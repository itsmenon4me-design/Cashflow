export interface CurrencySpec {
  code: string;
  minorUnits: number;
  primaryLocale: string;
  symbol?: string;
  hasMinorUnits?: boolean;
}

export const CURRENCY_SPECS: Record<string, CurrencySpec> = {
  IDR: { code: 'IDR', minorUnits: 0, primaryLocale: 'id-ID', symbol: 'Rp', hasMinorUnits: false },
};

export type SupportedCurrency = keyof typeof CURRENCY_SPECS;

export const SUPPORTED_CURRENCIES: readonly string[] = Object.keys(CURRENCY_SPECS);

export function getCurrencySpec(_code?: string): CurrencySpec {
  return CURRENCY_SPECS.IDR;
}

export function parseMoneyInput(input: string, _currency?: string, _locale?: string): number {
  if (!input || typeof input !== 'string') return 0;
  const cleaned = input.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  const value = parseInt(cleaned, 10);
  return isNaN(value) ? 0 : value;
}

export function formatMoneyFromMinorUnits(
  amount: string | number | bigint,
  _currency?: string,
): string {
  let normalized: bigint;
  try {
    normalized = typeof amount === 'bigint'
      ? amount
      : typeof amount === 'number'
        ? BigInt(Math.trunc(amount))
        : BigInt(amount.trim() || '0');
  } catch {
    normalized = BigInt(0);
  }
  return formatMinorUnitsExactly(normalized);
}

function formatMinorUnitsExactly(amount: bigint): string {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const positiveParts = formatter.formatToParts(0);
  const negativeParts = formatter.formatToParts(-0);
  const negative = amount < BigInt(0);
  const absolute = (negative ? -amount : amount).toString();
  const groupProbe = formatter.formatToParts(98765);
  const group = groupProbe.find((part) => part.type === 'group')?.value ?? '.';
  const decimal = positiveParts.find((part) => part.type === 'decimal')?.value ?? '.';
  const groupedInteger = absolute.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const parts = negative ? negativeParts : positiveParts;

  const normalizedParts = parts.filter((part, index) => {
    const previous = parts[index - 1];
    return !(
      part.type === 'literal' &&
      previous?.type === 'currency' &&
      (part.value === ' ' || part.value === '\u00A0')
    );
  });

  return normalizedParts.map((part) => {
    if (part.type === 'integer') return groupedInteger;
    if (part.type === 'fraction') return '';
    if (part.type === 'decimal') return decimal;
    return part.value;
  }).join('');
}

export function formatCurrency(amount: number, _currency?: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function toMinorUnits(majorUnits: number, _currency?: string): number {
  return Math.round(majorUnits);
}

export function toMajorUnits(minorUnits: number | bigint, _currency?: string): number {
  const amount = typeof minorUnits === 'bigint' ? Number(minorUnits) : minorUnits;
  return Number(amount);
}

export function extractDigits(value: string): string {
  return (value || '').replace(/[^\d]/g, '');
}

export function formatRupiah(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
