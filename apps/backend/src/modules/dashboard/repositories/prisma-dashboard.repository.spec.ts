import { PrismaDashboardRepository } from './prisma-dashboard.repository';
import { DashboardSummaryResponseDto } from '../dto/dashboard-summary-response.dto';
import type { PrismaService } from '../../../database/prisma.service';

describe('PrismaDashboardRepository.getSummary', () => {
  it('aggregates IDR accounts correctly', async () => {
    const prismaMock = {
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

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
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

    const prismaMock = {
      account: { findMany: accountFind },
      transaction: { findMany: txFind, count: jest.fn().mockResolvedValue(0) },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
    const res = await repo.getSummary(
      'u2',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(accountFind).toHaveBeenCalledTimes(1);
    // Verify repository asked prisma to exclude deleted accounts
    const callArgs = (
      accountFind.mock.calls[0] as unknown[] | undefined
    )?.[0] as { where?: { deleted_at?: unknown } } | undefined;
    expect(callArgs?.where).toBeDefined();
    expect(callArgs?.where?.deleted_at).toBeNull();

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
    const prismaMock = {
      account: { findMany: accFind },
      transaction: { findMany: txFind, count: jest.fn().mockResolvedValue(1) },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
    const res = await repo.getSummary(
      'u3',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    expect(txFind).toHaveBeenCalledTimes(2); // income and expense queries
    const incomeCallArgs = (
      txFind.mock.calls[0] as unknown[] | undefined
    )?.[0] as { where?: { deleted_at?: unknown } } | undefined;
    expect(incomeCallArgs?.where?.deleted_at).toBeNull();

    // Confirm income aggregated properly
    const idrEntry = res.by_currency!.find((b) => b.currency === 'IDR');
    expect(idrEntry?.total_income_cents).toBe('100000');
  });

  it('returns IDR zeroed when no accounts exist (empty dataset)', async () => {
    const prismaMock = {
      account: { findMany: jest.fn().mockResolvedValue([]) },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      category: { count: jest.fn().mockResolvedValue(0) },
    };

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
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
    const prismaMock = {
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

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
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

  it('ensures values are not double-scaled during aggregation', async () => {
    const prismaMock = {
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

    const repo = new PrismaDashboardRepository(
      prismaMock as unknown as PrismaService,
    );
    const res = await repo.getSummary(
      'u8',
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );

    // balances stay in minor units, never scaled by 100
    expect(res.by_currency![0].currency).toBe('IDR');
    expect(res.by_currency![0].total_assets_cents).toBe('110000');
    expect(res.total_assets_cents).toBe('110000');
  });
});
