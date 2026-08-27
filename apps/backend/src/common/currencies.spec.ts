import { CURRENCY_SPECS, DASHBOARD_CURRENCIES, SUPPORTED_CURRENCIES, FIXED_CURRENCY, getCurrencySpec } from './currencies';

describe('canonical currencies (IDR-only)', () => {
  it('FIXED_CURRENCY is IDR', () => {
    expect(FIXED_CURRENCY).toBe('IDR');
  });

  it('exposes exactly IDR in dashboard and supported lists', () => {
    expect(DASHBOARD_CURRENCIES).toEqual(['IDR']);
    expect(SUPPORTED_CURRENCIES).toEqual(['IDR']);
  });

  it('CURRENCY_SPECS contains only the IDR spec', () => {
    expect(Object.keys(CURRENCY_SPECS)).toEqual(['IDR']);
    expect(CURRENCY_SPECS.IDR).toMatchObject({
      code: 'IDR',
      minorUnits: 0,
      primaryLocale: 'id-ID',
      symbol: 'Rp',
      hasMinorUnits: false,
    });
  });

  it.each([undefined, 'IDR', 'USD', 'SGD', 'EUR', '', 'random'])(
    'getCurrencySpec(%p) always returns the IDR spec',
    (code) => {
      expect(getCurrencySpec(code as string | undefined)).toBe(CURRENCY_SPECS.IDR);
    },
  );
});
