import { CURRENCY_SPECS, DASHBOARD_CURRENCIES, SUPPORTED_CURRENCIES } from './currencies';

describe('canonical currencies', () => {
  it('exposes exactly the 13 supported dashboard currencies', () => {
    const expected = [
      'IDR','USD','SGD','EUR','JPY','VND','MYR','THB','PHP','GBP','AUD','CNY','HKD'
    ];
    expect(DASHBOARD_CURRENCIES.slice().sort()).toEqual(expected.slice().sort());
    expect(SUPPORTED_CURRENCIES.slice().sort()).toEqual(expected.slice().sort());
  });

  it('CURRENCY_SPECS contains entries for each dashboard currency', () => {
    for (const c of DASHBOARD_CURRENCIES) {
      expect(CURRENCY_SPECS[c]).toBeDefined();
      expect(typeof CURRENCY_SPECS[c].minorUnits).toBe('number');
      expect(typeof CURRENCY_SPECS[c].primaryLocale).toBe('string');
    }
  });
});
