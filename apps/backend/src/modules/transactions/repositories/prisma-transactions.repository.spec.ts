import { PrismaTransactionsRepository } from './prisma-transactions.repository';

const makePrismaMock = () => {
  return {
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
};

describe('PrismaTransactionsRepository date handling', () => {
  it('applies inclusive end-of-day for toDate filter', async () => {
    const prisma = makePrismaMock();
    const repo = new PrismaTransactionsRepository(prisma as any);

    const filter: any = { toDate: '2026-08-31' };
    const pagination = { page: 1, limit: 10 };

    await repo.findByUserWithFilter('user-1', filter, pagination);

    expect(prisma.transaction.findMany).toHaveBeenCalled();
    const calledWhere = prisma.transaction.findMany.mock.calls[0][0].where;
    expect(calledWhere.transaction_date.lte).toBeInstanceOf(Date);
    const dt: Date = calledWhere.transaction_date.lte;
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(7); // August is month 7 zero-based
    expect(dt.getDate()).toBe(31);
    expect(dt.getHours()).toBe(23);
    expect(dt.getMinutes()).toBe(59);
    expect(dt.getSeconds()).toBe(59);
    expect(dt.getMilliseconds()).toBe(999);
  });
});

describe('PrismaTransactionsRepository keyword (q) safety', () => {
  const makeRepo = () => {
    const prisma = makePrismaMock();
    const repo = new PrismaTransactionsRepository(prisma as any);
    return { prisma, repo };
  };

  const whereOf = (prisma: any, callIndex = 0) =>
    prisma.transaction.findMany.mock.calls[callIndex][0].where;

  it('plain digit queries never produce a uuid id predicate (used to 500 with "invalid input syntax for type uuid")', async () => {
    const { prisma, repo } = makeRepo();

    for (const q of ['77777777', '12345678', 'deadbeef', '1234567890123456']) {
      await repo.findByUserWithFilter('user-1', { q } as any, { page: 1, limit: 10 });
      const where = whereOf(prisma);
      const or = where.AND.find((part: any) => part.OR).OR as Array<Record<string, unknown>>;
      expect(or.some((clause) => 'id' in clause)).toBe(false);
    }
  });

  it('real UUID-shaped queries still match by id', async () => {
    const { prisma, repo } = makeRepo();
    const uuid = 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';

    await repo.findByUserWithFilter('user-1', { q: uuid } as any, { page: 1, limit: 10 });
    const or = whereOf(prisma).AND.find((part: any) => part.OR).OR as Array<Record<string, unknown>>;
    expect(or).toContainEqual({ id: uuid });
  });

  it('out-of-Int64 numeric queries never reach amount_cents', async () => {
    const { prisma, repo } = makeRepo();

    await repo.findByUserWithFilter('user-1', { q: '99999999999999999999999999' } as any, { page: 1, limit: 10 });
    const or = whereOf(prisma).AND.find((part: any) => part.OR).OR as Array<Record<string, unknown>>;
    expect(or.some((clause) => 'amount_cents' in clause)).toBe(false);
  });

  it('searchByUser applies the same guards', async () => {
    const { prisma, repo } = makeRepo();

    await repo.searchByUser('user-1', '77777777', { page: 1, limit: 10 }, 'IDR');
    const where = whereOf(prisma);
    // find the keyword OR array wherever it is nested (currency scoping wraps it)
    const findOr = (node: any): Array<Record<string, unknown>> | null => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node.OR)) return node.OR;
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
          const found = findOr(value);
          if (found) return found;
        }
      }
      return null;
    };
    const or = findOr(where);
    expect(or).toBeTruthy();
    expect(or!.some((clause) => 'id' in clause)).toBe(false);
  });
});