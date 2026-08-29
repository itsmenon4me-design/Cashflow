import { describe, it, expect } from 'vitest';
import { toCreateTransactionPayload } from './transaction.service';

describe('toCreateTransactionPayload regression - IDR 100k', () => {
  it('produces amount_cents = 100000 for IDR input amount 100000', () => {
    const values = {
      date: '2026-08-01',
      type: 'income',
      category: 'Salary',
      amount: 100000,
      description: 'Test income',
      notes: undefined,
    } as any;

    const categoryNames = { c1: 'Salary' };

    const payload = toCreateTransactionPayload(values, categoryNames);
    expect(payload).not.toBeNull();
    expect(payload?.amount_cents).toBe(100000);
  });
});