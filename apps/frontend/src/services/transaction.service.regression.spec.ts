import { describe, it, expect } from 'vitest';
import { toCreateTransactionPayload } from './transaction.service';

describe('toCreateTransactionPayload regression - IDR 100k', () => {
  it('produces amount_cents = 100000 for IDR input amount 100000', () => {
    const values = {
      date: '2026-08-01',
      type: 'income',
      category: 'Salary',
      account: 'Cash',
      amount: 100000,
      description: 'Test income',
      notes: undefined,
    } as any;

    const accountNames = { a1: 'Cash' };
    const categoryNames = { c1: 'Salary' };
    const accountCurrencies = { a1: 'IDR' };

    const payload = toCreateTransactionPayload(values, accountNames, categoryNames, accountCurrencies);
    expect(payload).not.toBeNull();
    expect(payload?.amount_cents).toBe(100000);
  });

  it('honors forcedType when provided (income)', () => {
    const values = {
      date: '2026-08-02',
      type: 'expense', // original value should be overridden
      category: 'Salary',
      account: 'Cash',
      amount: 50000,
      description: 'Forced income',
      notes: undefined,
    } as any;

    const accountNames = { a1: 'Cash' };
    const categoryNames = { c1: 'Salary' };
    const accountCurrencies = { a1: 'IDR' };

    const payload = toCreateTransactionPayload(values, accountNames, categoryNames, accountCurrencies, 'income');
    expect(payload).not.toBeNull();
    expect(payload?.transaction_type).toBe('INCOME');
  });

  it('honors forcedType when provided (expense)', () => {
    const values = {
      date: '2026-08-03',
      type: 'income', // original value should be overridden
      category: 'Salary',
      account: 'Cash',
      amount: 75000,
      description: 'Forced expense',
      notes: undefined,
    } as any;

    const accountNames = { a1: 'Cash' };
    const categoryNames = { c1: 'Salary' };
    const accountCurrencies = { a1: 'IDR' };

    const payload = toCreateTransactionPayload(values, accountNames, categoryNames, accountCurrencies, 'expense');
    expect(payload).not.toBeNull();
    expect(payload?.transaction_type).toBe('EXPENSE');
  });
});
