import { describe, it, expect } from 'vitest';
import { formatCurrencyCents } from './format';

describe('formatCurrencyCents', () => {
it('formats every IDR minor-unit regression value without a /100 transform', () => {
    const cases: Array<[bigint, string]> = [
      [BigInt(1), 'Rp1'], [BigInt(7), 'Rp7'], [BigInt(17), 'Rp17'], [BigInt(137), 'Rp137'], [BigInt(501), 'Rp501'],
      [BigInt(999), 'Rp999'], [BigInt(1000), 'Rp1.000'], [BigInt(1001), 'Rp1.001'],
      [BigInt(1234567), 'Rp1.234.567'], [BigInt(123456789), 'Rp123.456.789'],
      [BigInt(1000000), 'Rp1.000.000'],
    ];
    for (const [amount, expected] of cases) expect(formatCurrencyCents(amount, 'IDR')).toBe(expected);
  });

  it('formats the full 2-decimal minor-unit matrix for USD', () => {
    const cases: Array<[string, string]> = [
      ['1', '$0.01'], ['7', '$0.07'], ['17', '$0.17'], ['99', '$0.99'], ['100', '$1.00'], ['101', '$1.01'],
      ['123', '$1.23'], ['1747', '$17.47'], ['13759', '$137.59'], ['99991', '$999.91'], ['123457', '$1,234.57'],
      ['100000099', '$1,000,000.99'],
    ];
    for (const [amount, expected] of cases) expect(formatCurrencyCents(amount, 'USD')).toBe(expected);
  });

  it('formats the full 2-decimal minor-unit matrix for SGD', () => {
    const cases: Array<[string, string]> = [
      ['1', '$0.01'], ['7', '$0.07'], ['17', '$0.17'], ['99', '$0.99'], ['100', '$1.00'], ['101', '$1.01'],
      ['123', '$1.23'], ['1747', '$17.47'], ['13759', '$137.59'], ['99991', '$999.91'], ['123457', '$1,234.57'],
      ['100000099', '$1,000,000.99'],
    ];
    for (const [amount, expected] of cases) expect(formatCurrencyCents(amount, 'SGD')).toBe(expected);
  });

  it('formats the full 2-decimal minor-unit matrix for EUR', () => {
    const cases: Array<[string, string]> = [
      ['1', '0,01\u00A0€'], ['7', '0,07\u00A0€'], ['17', '0,17\u00A0€'], ['99', '0,99\u00A0€'], ['100', '1,00\u00A0€'],
      ['101', '1,01\u00A0€'], ['123', '1,23\u00A0€'], ['1747', '17,47\u00A0€'], ['13759', '137,59\u00A0€'],
      ['99991', '999,91\u00A0€'], ['123457', '1.234,57\u00A0€'], ['100000099', '1.000.000,99\u00A0€'],
    ];
    for (const [amount, expected] of cases) expect(formatCurrencyCents(amount, 'EUR')).toBe(expected);
  });

  it('accepts backend minor-unit strings without coercion and keeps values above Number.MAX_SAFE_INTEGER exact', () => {
    expect(formatCurrencyCents('9007199254740993', 'IDR')).toBe('Rp9.007.199.254.740.993');
    expect(formatCurrencyCents('9007199254740993', 'USD')).toBe('$90,071,992,547,409.93');
    expect(formatCurrencyCents('9007199254740993', 'SGD')).toBe('$90,071,992,547,409.93');
    expect(formatCurrencyCents('9007199254740993', 'EUR')).toBe('90.071.992.547.409,93\u00A0€');
    // Adjacent strings two minor units apart must stay distinct: a Number()
    // round trip would collapse both to the same value.
    expect(formatCurrencyCents('9007199254740991', 'USD')).not.toBe(
      formatCurrencyCents('9007199254740993', 'USD'),
    );
  });

  it('renders zero and negative minor units without flipping the sign', () => {
    expect(formatCurrencyCents('0', 'IDR')).toBe('Rp0');
    expect(formatCurrencyCents('0', 'USD')).toBe('$0.00');
    expect(formatCurrencyCents('-1', 'IDR')).toBe('-Rp1');
    expect(formatCurrencyCents('-137', 'IDR')).toBe('-Rp137');
    expect(formatCurrencyCents('-1000000', 'IDR')).toBe('-Rp1.000.000');
    expect(formatCurrencyCents('-1', 'USD')).toBe('-$0.01');
    expect(formatCurrencyCents('-123', 'USD')).toBe('-$1.23');
    expect(formatCurrencyCents('-1747', 'USD')).toBe('-$17.47');
    expect(formatCurrencyCents('-1', 'EUR')).toBe('-0,01\u00A0€');
  });

  it('renders random non-round minor units exactly', () => {
    expect(formatCurrencyCents('123', 'USD')).toBe('$1.23');
    expect(formatCurrencyCents('137', 'USD')).toBe('$1.37');
    expect(formatCurrencyCents('1747', 'USD')).toBe('$17.47');
    expect(formatCurrencyCents('9991', 'USD')).toBe('$99.91');
    expect(formatCurrencyCents('12359', 'USD')).toBe('$123.59');
    expect(formatCurrencyCents('123457', 'SGD')).toBe('$1,234.57');
  });

  it('never reintroduces the /100 artifact or IDR decimal noise', () => {
    const idr = formatCurrencyCents('1000000', 'IDR');
    expect(idr).toBe('Rp1.000.000');
    expect(idr).not.toContain('100.000.000');
    expect(idr).not.toContain('10.000');
    expect(idr).not.toContain(',');
    // USD 1.23 (123 minor units) must be neither "1" (mag) nor "12300" (x100).
    expect(formatCurrencyCents('123', 'USD')).not.toBe('$1');
    expect(formatCurrencyCents('123', 'USD')).not.toContain('12300');
  });

  it('formats USD, SGD, and EUR according to their currency locale and precision', () => {
    expect(formatCurrencyCents(BigInt(1), 'USD')).toBe('$0.01');
    expect(formatCurrencyCents(BigInt(7), 'USD')).toBe('$0.07');
    expect(formatCurrencyCents(BigInt(13759), 'USD')).toBe('$137.59');
    expect(formatCurrencyCents(BigInt(100000099), 'USD')).toBe('$1,000,000.99');
    expect(formatCurrencyCents(BigInt(1747), 'SGD')).toBe('$17.47');
    expect(formatCurrencyCents(BigInt(1747), 'EUR')).toBe('17,47 €');
  });

  it('preserves zero, negative values, random values, and values above Number.MAX_SAFE_INTEGER', () => {
    expect(formatCurrencyCents(BigInt(0), 'IDR')).toBe('Rp0');
    expect(formatCurrencyCents(BigInt(-137), 'IDR')).toBe('-Rp137');
    expect(formatCurrencyCents(BigInt(-123), 'USD')).toBe('-$1.23');
    expect(formatCurrencyCents(BigInt('9876543210987654321'), 'IDR')).toBe('Rp9.876.543.210.987.654.321');
    for (const amount of [42, 731, 12345, 999999, 100000099].map(BigInt)) {
      expect(formatCurrencyCents(amount, 'USD')).toMatch(/^\$[\d,]+\.\d{2}$/);
    }
  });
});
