import { CategoryBreakdownService } from './category-breakdown.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';

const makePrismaMock = (
  groups: Prisma.TransactionGroupByOutputType[] = [],
  total = 1000,
  cats: Array<{ id: string; name: string | null }> = [],
): Partial<PrismaService> => {
  const mock: Partial<PrismaService> = {
    transaction: {
      aggregate: jest.fn(() =>
        Promise.resolve({ _sum: { amount_cents: total } }),
      ) as unknown as PrismaService['transaction']['aggregate'],
      groupBy: jest.fn(() =>
        Promise.resolve(groups),
      ) as unknown as PrismaService['transaction']['groupBy'],
    } as unknown as PrismaService['transaction'],
    category: {
      findMany: jest.fn(() =>
        Promise.resolve(cats),
      ) as unknown as PrismaService['category']['findMany'],
    } as unknown as PrismaService['category'],
    account: {
      findMany: jest.fn(() =>
        Promise.resolve([{ currency: 'IDR', is_default: true }]),
      ) as unknown as PrismaService['account']['findMany'],
    } as unknown as PrismaService['account'],
  };
  return mock;
};

describe('CategoryBreakdownService', () => {
  it('calculates breakdown for multiple categories', async () => {
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 600 },
        _count: { id: 6 },
      } as unknown as Prisma.TransactionGroupByOutputType,
      {
        category_id: 'c2',
        _sum: { amount_cents: 400 },
        _count: { id: 4 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [
      { id: 'c1', name: 'Food' },
      { id: 'c2', name: 'Travel' },
    ];
    const prisma = makePrismaMock(groups, 1000, cats);
    const svc = new CategoryBreakdownService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getBreakdown('user-1', 'expense', 8, 2026);
    expect(res.type).toBe('expense');
    expect(res.total).toBe('1000');
    expect(res.categories.length).toBe(2);
    expect(res.categories[0].categoryName).toBe('Food');
    expect(
      Math.round(res.categories[0].percentage + res.categories[1].percentage),
    ).toBe(100);
  });

  it('calculates for one category', async () => {
    const groups: Prisma.TransactionGroupByOutputType[] = [
      {
        category_id: 'c1',
        _sum: { amount_cents: 1000 },
        _count: { id: 10 },
      } as unknown as Prisma.TransactionGroupByOutputType,
    ];
    const cats = [{ id: 'c1', name: 'Salary' }];
    const prisma = makePrismaMock(groups, 1000, cats);
    const svc = new CategoryBreakdownService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getBreakdown('user-1', 'income', 7, 2026);
    expect(res.total).toBe('1000');
    expect(res.categories.length).toBe(1);
    expect(res.categories[0].percentage).toBe(100);
    expect(res.categories[0].transactionCount).toBe(10);
  });

  it('returns empty when no data', async () => {
    const prisma = makePrismaMock([], 0, []);
    const svc = new CategoryBreakdownService(
      prisma as unknown as PrismaService,
    );
    const res = await svc.getBreakdown('user-1', 'expense', 2, 2025);
    expect(res.total).toBe('0');
    expect(res.categories).toEqual([]);
  });

  it('rejects invalid type or month', async () => {
    const prisma = makePrismaMock([], 0, []);
    const svc = new CategoryBreakdownService(
      prisma as unknown as PrismaService,
    );
    await expect(
      svc.getBreakdown(
        'user-1',
        'foo' as unknown as 'income' | 'expense',
        8,
        2026,
      ),
    ).rejects.toThrow();
    await expect(
      svc.getBreakdown('user-1', 'expense', 13, 2026),
    ).rejects.toThrow();
  });
});
