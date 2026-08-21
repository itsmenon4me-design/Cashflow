import { beforeEach, describe, expect, it } from 'vitest';
import {
  hydrateDashboardCurrency,
  useDashboardCurrencyStore,
} from './dashboardCurrency.store';

describe('dashboard currency store hydration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useDashboardCurrencyStore.setState({
      currency: 'USD',
      hydrated: false,
    });
  });

  it('transitions from hydrated=false to true when storage is read', () => {
    expect(useDashboardCurrencyStore.getState().hydrated).toBe(false);

    window.localStorage.setItem('cashflow-dashboard-currency', 'IDR');

    const nextCurrency = hydrateDashboardCurrency();

    expect(nextCurrency).toBe('IDR');
    expect(useDashboardCurrencyStore.getState().currency).toBe('IDR');
    expect(useDashboardCurrencyStore.getState().hydrated).toBe(true);
  });
});
