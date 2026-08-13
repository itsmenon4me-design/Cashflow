import { BalanceService } from './balance.service';

describe('BalanceService.recalculateAccount', () => {
  it('recalculates balance with bigint aggregates', async () => {
    const accountRecord = {
      id: 'acc-1',
      opening_balance_cents: 100000n,
    } as any;

    const prismaMock: any = {
      account: {
        findUnique: jest.fn().mockResolvedValue(accountRecord),
        update: jest.fn().mockResolvedValue({}),
      },
      transaction: {
        aggregate: jest
          .fn()
          // first call -> income
          .mockResolvedValueOnce({ _sum: { amount_cents: 50000n } })
          // second call -> expense
          .mockResolvedValueOnce({ _sum: { amount_cents: 25000n } }),
      },
    };

    const svc = new BalanceService(prismaMock);

    const result = await svc.recalculateAccount('acc-1');

    expect(result).toBe(125000n);
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { current_balance_cents: 125000n },
    });
  });

  it('handles null aggregate sums and numeric sums (non-bigint)', async () => {
    const accountRecord = {
      id: 'acc-2',
      opening_balance_cents: 100000, // number, not bigint
    } as any;

    const prismaMock: any = {
      account: {
        findUnique: jest.fn().mockResolvedValue(accountRecord),
        update: jest.fn().mockResolvedValue({}),
      },
      transaction: {
        aggregate: jest
          .fn()
          // income returns null
          .mockResolvedValueOnce({ _sum: { amount_cents: null } })
          // expense returns numeric 25000
          .mockResolvedValueOnce({ _sum: { amount_cents: 25000 } }),
      },
    };

    const svc = new BalanceService(prismaMock);

    const result = await svc.recalculateAccount('acc-2');

    // opening 100000 + 0 - 25000 = 75000
    expect(result).toBe(75000n);

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-2' },
      data: { current_balance_cents: 75000n },
    });
  });
});
