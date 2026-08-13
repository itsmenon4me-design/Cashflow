import { PrismaDashboardRepository } from './prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import { TransactionType } from '../../../generated/prisma/client';

describe('PrismaDashboardRepository.getSummary', () => {
  it('aggregates IDR accounts correctly', async () => {
    const prismaMock: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'IDR',
            current_balance_cents: 100000n,
            is_default: true,
            updated_at: new Date(),
          },
          {
            id: 'a2',
            currency: 'IDR',
            current_balance_cents: 200000n,
            is_default: false,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res: DashboardSummaryResponseDto = await repo.getSummary(
      'u1',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(idrEntry).toBeDefined();
    expect(idrEntry?.total_assets_cents).toBe('300000');
    expect(res.total_accounts).toBe(2);
  });

  it('aggregates per-currency separately and does not mix USD and IDR', async () => {
    const prismaMock: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'IDR',
            current_balance_cents: 100000n,
            is_default: true,
            updated_at: new Date(),
          },
          {
            id: 'a2',
            currency: 'USD',
            current_balance_cents: 10000n,
            is_default: false,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u1',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    const usdEntry = res.by_currency!.find((b) => b.currency === 'USD');
    expect(idrEntry?.total_assets_cents).toBe('100000');
    expect(usdEntry?.total_assets_cents).toBe('10000');
    // primary currency should be the default account's currency (IDR)
    expect(res.currency).toBe('IDR');
  });

  it('excludes deleted accounts and queries with deleted_at = null', async () => {
    const accountFind = jest.fn().mockResolvedValue([
      // simulate that prisma returns only non-deleted accounts because query filters deleted_at: null
      {
        id: 'a1',
        currency: 'IDR',
        current_balance_cents: 100000n,
        is_default: true,
        updated_at: new Date(),
      },
      // a deleted account SHOULD NOT be returned by the prisma query; if it were, the repository logic would include it — but we assert the query was made with deleted_at: null
    ]);
    const txFind = jest.fn().mockResolvedValue([]);
    const accountCount = jest.fn();

    const prismaMock: any = {
      account: { findMany: accountFind },
      transaction: { findMany: txFind, count: jest.fn().mockResolvedValue(0) },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u2',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(accountFind).toHaveBeenCalledTimes(1);
    // Verify repository asked prisma to exclude deleted accounts
    const callArgs = accountFind.mock.calls[0][0];
    expect(callArgs.where).toBeDefined();
    expect(callArgs.where.deleted_at).toBeNull();

    // Validate result still contains only active account totals
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(idrEntry?.total_assets_cents).toBe('100000');
  });

  it('excludes deleted transactions and queries transactions with deleted_at = null', async () => {
    const txFind = jest.fn().mockResolvedValue([
      {
        amount_cents: 100000n,
        account: { currency: 'IDR' },
        updated_at: new Date(),
      },
    ]);
    const accFind = jest.fn().mockResolvedValue([]);
    const prismaMock: any = {
      account: { findMany: accFind },
      transaction: { findMany: txFind, count: jest.fn().mockResolvedValue(1) },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u3',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(txFind).toHaveBeenCalledTimes(2); // income and expense queries
    const incomeCallArgs = txFind.mock.calls[0][0];
    expect(incomeCallArgs.where.deleted_at).toBeNull();

    // Confirm income aggregated properly
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(idrEntry?.total_income_cents).toBe('100000');
  });

  it('returns IDR zeroed when no accounts exist (empty dataset)', async () => {
    const prismaMock: any = {
      account: { findMany: jest.fn().mockResolvedValue([]) },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u4',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(res.by_currency).toBeDefined();
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(idrEntry).toBeDefined();
    expect(idrEntry?.total_assets_cents).toBe('0');
    expect(res.total_assets_cents).toBe('0');
  });

  it('preserves BigInt precision and returns stringified totals', async () => {
    const big = BigInt('9007199254740993');
    const prismaMock: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'IDR',
            current_balance_cents: big,
            is_default: true,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u5',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(typeof res.total_assets_cents).toBe('string');
    expect(BigInt(res.total_assets_cents)).toBe(big);
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(BigInt(idrEntry!.total_assets_cents)).toBe(big);
  });

  it('selects primary currency deterministically (default account preference then insertion order)', async () => {
    // Case 1: default account exists
    const prismaMockDefault: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'USD',
            current_balance_cents: 10000n,
            is_default: true,
            updated_at: new Date(),
          },
          {
            id: 'a2',
            currency: 'IDR',
            current_balance_cents: 100000n,
            is_default: false,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };
    const repoDefault = new PrismaDashboardRepository(prismaMockDefault);
    const resDefault = await repoDefault.getSummary(
      'u6',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    expect(resDefault.currency).toBe('USD');

    // Case 2: no default, insertion order determines primary
    const prismaMockOrder: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'USD',
            current_balance_cents: 10000n,
            is_default: false,
            updated_at: new Date(),
          },
          {
            id: 'a2',
            currency: 'IDR',
            current_balance_cents: 100000n,
            is_default: false,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };
    const repoOrder = new PrismaDashboardRepository(prismaMockOrder);
    const resOrder = await repoOrder.getSummary(
      'u7',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    expect(resOrder.currency).toBe('USD');
  });

  it('ensures IDR and USD values are not double-scaled during aggregation', async () => {
    const prismaMock: any = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            currency: 'IDR',
            current_balance_cents: 100000n,
            is_default: true,
            updated_at: new Date(),
          },
          {
            id: 'a2',
            currency: 'USD',
            current_balance_cents: 10000n,
            is_default: false,
            updated_at: new Date(),
          },
        ]),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(prismaMock);
    const res = await repo.getSummary(
      'u8',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    const usdEntry = res.by_currency!.find((b) => b.currency === 'USD');

    // IDR should remain 100000 minor units, USD should remain 10000 minor units
    expect(idrEntry?.total_assets_cents).toBe('100000');
    expect(usdEntry?.total_assets_cents).toBe('10000');
    // Also primary totals should match primary currency assets only
    expect(res.total_assets_cents).toBe(idrEntry?.total_assets_cents);
  });
});
