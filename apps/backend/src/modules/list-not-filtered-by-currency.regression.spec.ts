import { PrismaSavingGoalsRepository } from './saving-goals/repositories/prisma-saving-goals.repository';
import { PrismaInvestmentsRepository } from './investments/repositories/prisma-investments.repository';
import { PrismaBudgetsRepository } from './budgets/repositories/prisma-budgets.repository';
import { PrismaTransactionsRepository } from './transactions/repositories/prisma-transactions.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * Regression: the list path must NEVER filter rows by currency.
 * Currency is a display concern (see migration 20260815113724 — nullable
 * entity currency columns). Re-adding a currency predicate here makes
 * records in other (or absent) currencies vanish from every list.
 */
describe('list must not be filtered by currency', () => {
  const userId = 'u1';
  const expectedWhere = { user_id: userId, deleted_at: null };

  type FindManyMock = jest.Mock & { mock: { calls: unknown[][] } };

  const makePrisma = (): Record<string, { findMany: FindManyMock }> => ({
    savingGoal: { findMany: jest.fn().mockResolvedValue([]) },
    investment: { findMany: jest.fn().mockResolvedValue([]) },
    budget: { findMany: jest.fn().mockResolvedValue([]) },
    transaction: { findMany: jest.fn().mockResolvedValue([]) },
  });

  const prisma = makePrisma() as unknown as PrismaService;

  const cases: Array<{
    name: string;
    model: string;
    repo: () => { findAllByUser(userId: string, currency?: string): Promise<unknown> };
  }> = [
    {
      name: 'saving goals',
      model: 'savingGoal',
      repo: () => new PrismaSavingGoalsRepository(prisma),
    },
    {
      name: 'investments',
      model: 'investment',
      repo: () => new PrismaInvestmentsRepository(prisma),
    },
    {
      name: 'budgets',
      model: 'budget',
      repo: () => new PrismaBudgetsRepository(prisma),
    },
    {
      name: 'transactions',
      model: 'transaction',
      repo: () => new PrismaTransactionsRepository(prisma),
    },
  ];

  it.each(cases)('$name: currency hint never reaches the where clause', async ({ model, repo }) => {
    const findMany = (prisma[model] as unknown as { findMany: FindManyMock }).findMany;

    await repo().findAllByUser(userId, 'USD');
    expect(findMany.mock.calls[0][0].where).toEqual(expectedWhere);

    await repo().findAllByUser(userId, 'IDR');
    expect(findMany.mock.calls[1][0].where).toEqual(expectedWhere);

    await repo().findAllByUser(userId);
    expect(findMany.mock.calls[2][0].where).toEqual(expectedWhere);

    // No OR/account-currency escape hatch anywhere in the query
    for (const call of findMany.mock.calls) {
      const arg = call[0] as { where: Record<string, unknown> };
      expect(arg.where).not.toHaveProperty('OR');
      expect(arg.where).not.toHaveProperty('currency');
      expect(arg.where).not.toHaveProperty('account');
    }
  });
});
