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