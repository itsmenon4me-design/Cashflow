import { PrismaSavingGoalsRepository } from './saving-goals/repositories/prisma-saving-goals.repository';
import { PrismaInvestmentsRepository } from './investments/repositories/prisma-investments.repository';
import { PrismaBudgetsRepository } from './budgets/repositories/prisma-budgets.repository';
import { PrismaTransactionsRepository } from './transactions/repositories/prisma-transactions.repository';
import { PrismaAccountsRepository } from './accounts/repositories/prisma-accounts.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * Regression: every currency is a fully separate ledger. List/find paths MUST
 * filter rows by the requested currency — rows belonging to another currency
 * must never appear in a ledger view.
 *
 * Nullable-currency modules (budgets, saving goals, investments) keep legacy
 * NULL-currency rows visible in every ledger via OR [currency, currency: null]
 * (or the account relation), while NEW rows always receive an explicit currency
 * (services default to the user's active currency, then IDR).
 */
describe('lists must be scoped to the requested currency ledger', () => {
  const userId = 'u1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  type FindManyMock = jest.Mock & { mock: { calls: unknown[][] } };

  const makePrisma = (): Record<string, { findMany: FindManyMock; findFirst?: FindManyMock; findUnique?: FindManyMock; count?: FindManyMock }> => ({
    savingGoal: { findMany: jest.fn().mockResolvedValue([]) },
    investment: { findMany: jest.fn().mockResolvedValue([]) },
    budget: { findMany: jest.fn().mockResolvedValue([]) },
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    account: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  });

  const prisma = makePrisma() as unknown as PrismaService;

  const cases: Array<{
    name: string;
    model: string;
    repo: () => { findAllByUser(userId: string, currency?: string): Promise<unknown> };
    expectedWhere: (currency: string) => Record<string, unknown>;
  }> = [
    {
      name: 'accounts',
      model: 'account',
      repo: () => new PrismaAccountsRepository(prisma),
      expectedWhere: (currency) => ({ user_id: userId, deleted_at: null, currency }),
    },
    {
      name: 'saving goals',
      model: 'savingGoal',
      repo: () => new PrismaSavingGoalsRepository(prisma),
      expectedWhere: (currency) => ({
        user_id: userId,
        deleted_at: null,
        OR: [{ currency }, { account: { currency } }],
      }),
    },
    {
      name: 'investments',
      model: 'investment',
      repo: () => new PrismaInvestmentsRepository(prisma),
      expectedWhere: (currency) => ({
        user_id: userId,
        deleted_at: null,
        OR: [{ currency }, { account: { currency } }],
      }),
    },
    {
      name: 'budgets',
      model: 'budget',
      repo: () => new PrismaBudgetsRepository(prisma),
      expectedWhere: (currency) => ({
        user_id: userId,
        deleted_at: null,
        OR: [{ currency }, { currency: null }],
      }),
    },
  ];

  it.each(cases)('$name: findAllByUser filters by the requested currency', async ({ model, repo, expectedWhere }) => {
    const findMany = (prisma as unknown as Record<string, { findMany: FindManyMock }>)[model].findMany;
    await repo().findAllByUser(userId, 'USD');
    expect(findMany.mock.calls[0][0].where).toEqual(expectedWhere('USD'));

    await repo().findAllByUser(userId, 'IDR');
    expect(findMany.mock.calls[1][0].where).toEqual(expectedWhere('IDR'));
  });

  it('transactions: list filters rows by the account ledger currency', async () => {
    const repo = new PrismaTransactionsRepository(prisma);
    const filter = { currency: 'USD' } as any;

    await repo.findByUserWithFilter(userId, filter, { page: 1, limit: 20 });

    const findMany = (prisma.transaction as unknown as { findMany: FindManyMock }).findMany;
    const where = findMany.mock.calls[0][0].where as any;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: { currency: 'USD' },
        }),
      ]),
    );
  });

  it('transactions: search scopes to the requested currency ledger', async () => {
    const repo = new PrismaTransactionsRepository(prisma);

    await repo.searchByUser(userId, 'food', { page: 1, limit: 20 }, 'IDR');

    const findMany = (prisma.transaction as unknown as { findMany: FindManyMock }).findMany;
    const where = findMany.mock.calls[0][0].where as any;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: { currency: 'IDR' },
        }),
      ]),
    );
  });

  it('accounts: findById hides the account when it belongs to another ledger', async () => {
    const repo = new PrismaAccountsRepository(prisma);
    const findFirst = (prisma.account as unknown as { findFirst: FindManyMock }).findFirst;

    await repo.findById('acc-1', 'USD');
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 'acc-1',
      deleted_at: null,
      currency: 'USD',
    });
  });
});
