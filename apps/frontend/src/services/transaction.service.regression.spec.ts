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

  it.each([
    ["Asia/Jakarta", "2026-09-28T03:00:00.000Z"],
    ["Asia/Makassar", "2026-09-28T02:00:00.000Z"],
    ["Asia/Jayapura", "2026-09-28T01:00:00.000Z"],
  ])("serializes a 10:00 transaction in %s as UTC", (timeZone, expected) => {
    const payload = toCreateTransactionPayload(
      {
        date: "2026-09-28",
        time: "10:00",
        type: "income",
        category: "Salary",
        amount: 100000,
      },
      { c1: "Salary" },
      undefined,
      timeZone,
    );

    expect(payload?.transaction_date).toBe(expected);
  });
});