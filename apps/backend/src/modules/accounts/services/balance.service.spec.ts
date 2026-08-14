import { BalanceService } from './balance.service';
import type { PrismaService } from '../../../database/prisma.service';

interface MockedAccountRecord {
  id: string;
  opening_balance_cents: bigint | number;
  current_balance_cents?: bigint | number;
}

interface BalancePrismaMocks {
  account: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  transaction: {
    aggregate: jest.Mock;
  };
}

describe('BalanceService.recalculateAccount', () => {
  it('recalculates balance with bigint aggregates', async () => {
    const accountRecord: MockedAccountRecord = {
      id: 'acc-1',
      opening_balance_cents: 100000n,
    };

    const prismaMock: BalancePrismaMocks = {
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

    const svc = new BalanceService(prismaMock as unknown as PrismaService);

    const result = await svc.recalculateAccount('acc-1');

    expect(result).toBe(125000n);
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { current_balance_cents: 125000n },
    });
  });

  it('handles null aggregate sums and numeric sums (non-bigint)', async () => {
    const accountRecord: MockedAccountRecord = {
      id: 'acc-2',
      opening_balance_cents: 100000, // number, not bigint
    };

    const prismaMock: BalancePrismaMocks = {
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

    const svc = new BalanceService(prismaMock as unknown as PrismaService);

    const result = await svc.recalculateAccount('acc-2');

    // opening 100000 + 0 - 25000 = 75000
    expect(result).toBe(75000n);

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-2' },
      data: { current_balance_cents: 75000n },
    });
  });
});
