import { TransactionType } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/database/prisma.service';

export interface ReconciliationSeed {
  users: Record<'A' | 'B' | 'C' | 'M' | 'J', string>;
  ids: string[];
}

interface SeedTracker {
  ids: string[];
}

export async function seedReconciliation(
  prisma: PrismaService,
  tracker: SeedTracker,
): Promise<ReconciliationSeed> {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const users = {} as ReconciliationSeed['users'];
  const categories: Record<
    'A' | 'B' | 'C' | 'M' | 'J',
    { income: string; expense: string }
  > = {} as Record<
    'A' | 'B' | 'C' | 'M' | 'J',
    { income: string; expense: string }
  >;

  for (const label of ['A', 'B', 'C', 'M', 'J'] as const) {
    const email = `reconcile-${runId}-${label.toLowerCase()}@test.local`;
    const user = await prisma.user.create({
      data: {
        email,
        username: `reconcile-${runId}-${label.toLowerCase()}`,
        full_name: `Reconciliation ${label}`,
        password_hash: 'not-used-by-reconciliation-tests',
        status: 'ACTIVE',
      },
    });
    tracker.ids.push(user.id);
    users[label] = user.id;

    const income = await prisma.category.create({
      data: {
        user_id: user.id,
        name: `Reconcile ${label} income`,
        type: 'INCOME',
      },
    });
    const expense = await prisma.category.create({
      data: {
        user_id: user.id,
        name: `Reconcile ${label} expense`,
        type: 'EXPENSE',
      },
    });
    categories[label] = { income: income.id, expense: expense.id };

    await prisma.userSettings.create({
      data: {
        user_id: user.id,
        timezone:
          label === 'M'
            ? 'Asia/Makassar'
            : label === 'J'
              ? 'Asia/Jayapura'
              : 'Asia/Jakarta',
      },
    });
  }

  const addTransaction = async (
    user: 'A' | 'B' | 'C' | 'M' | 'J',
    date: string,
    type: TransactionType,
    cents: bigint,
    deletedAt?: string,
  ) => {
    await prisma.transaction.create({
      data: {
        user_id: users[user],
        category_id:
          type === TransactionType.INCOME
            ? categories[user].income
            : categories[user].expense,
        transaction_type: type,
        amount_cents: cents,
        transaction_date: new Date(date),
        created_at: new Date('2026-09-15T05:00:00.000Z'),
        updated_at: new Date('2026-09-15T05:00:00.000Z'),
        note: 'reconciliation seed',
        deleted_at: deletedAt ? new Date(deletedAt) : null,
      },
    });
  };

  for (const month of [
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
  ]) {
    await addTransaction(
      'A',
      `${month}-15T12:00:00.000Z`,
      TransactionType.INCOME,
      1_000_000n,
    );
    await addTransaction(
      'A',
      `${month}-16T12:00:00.000Z`,
      TransactionType.EXPENSE,
      400_000n,
    );
  }
  // Reconciliation deliberately includes transactions dated after the frozen
  // forecast time to document cutoff-based opening-balance behavior.
  await addTransaction(
    'A',
    '2026-08-31T23:59:00+07:00',
    TransactionType.EXPENSE,
    100_000n,
  );
  await addTransaction(
    'A',
    '2026-09-01T03:00:00+07:00',
    TransactionType.INCOME,
    250_000n,
  );
  await addTransaction(
    'A',
    '2026-09-07T00:30:00+07:00',
    TransactionType.EXPENSE,
    50_000n,
  );
  await addTransaction(
    'A',
    '2026-09-20T12:00:00+07:00',
    TransactionType.EXPENSE,
    70_000n,
  );
  await addTransaction(
    'A',
    '2026-10-05T12:00:00+07:00',
    TransactionType.INCOME,
    90_000n,
  );
  await addTransaction(
    'A',
    '2026-08-31T22:00:00+07:00',
    TransactionType.INCOME,
    999_000n,
    '2026-08-31T23:00:00+07:00',
  );

  await addTransaction(
    'B',
    '2026-09-01T12:00:00+07:00',
    TransactionType.INCOME,
    300_000n,
  );
  await addTransaction(
    'B',
    '2026-09-02T12:00:00+07:00',
    TransactionType.EXPENSE,
    100_000n,
  );

  await addTransaction(
    'C',
    '2026-08-10T12:00:00+07:00',
    TransactionType.INCOME,
    100_000n,
  );
  await addTransaction(
    'C',
    '2026-08-20T12:00:00+07:00',
    TransactionType.EXPENSE,
    300_000n,
  );
  await addTransaction(
    'C',
    '2026-09-01T12:00:00+07:00',
    TransactionType.INCOME,
    400_000n,
  );
  await addTransaction(
    'C',
    '2026-09-07T12:00:00+07:00',
    TransactionType.EXPENSE,
    100_000n,
  );

  await addTransaction(
    'M',
    '2026-07-31T16:00:00.000Z',
    TransactionType.INCOME,
    10_000n,
  );
  await addTransaction(
    'M',
    '2026-08-31T15:59:59.000Z',
    TransactionType.EXPENSE,
    1_000n,
  );
  await addTransaction(
    'M',
    '2026-08-31T16:00:00.000Z',
    TransactionType.INCOME,
    20_000n,
  );
  await addTransaction(
    'M',
    '2026-08-31T16:00:01.000Z',
    TransactionType.EXPENSE,
    2_000n,
  );

  await addTransaction(
    'J',
    '2026-07-31T15:00:00.000Z',
    TransactionType.INCOME,
    30_000n,
  );
  await addTransaction(
    'J',
    '2026-08-31T14:59:59.000Z',
    TransactionType.EXPENSE,
    3_000n,
  );
  await addTransaction(
    'J',
    '2026-08-31T15:00:00.000Z',
    TransactionType.INCOME,
    40_000n,
  );
  await addTransaction(
    'J',
    '2026-08-31T15:00:01.000Z',
    TransactionType.EXPENSE,
    4_000n,
  );

  return { users, ids: tracker.ids };
}

export async function cleanupReconciliation(
  prisma: PrismaService,
  userIds: string[],
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};

  const transactions = await prisma.transaction.deleteMany({
    where: { user_id: { in: userIds } },
  });
  const budgets = await prisma.budget.deleteMany({
    where: { user_id: { in: userIds } },
  });
  const settings = await prisma.userSettings.deleteMany({
    where: { user_id: { in: userIds } },
  });
  const categories = await prisma.category.deleteMany({
    where: { user_id: { in: userIds } },
  });
  const users = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  const [
    remainingUsers,
    remainingTransactions,
    remainingCategories,
    remainingSettings,
  ] = await Promise.all([
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.transaction.count({ where: { user_id: { in: userIds } } }),
    prisma.category.count({ where: { user_id: { in: userIds } } }),
    prisma.userSettings.count({ where: { user_id: { in: userIds } } }),
  ]);

  return {
    transactions: transactions.count,
    budgets: budgets.count,
    settings: settings.count,
    categories: categories.count,
    users: users.count,
    remainingUsers,
    remainingTransactions,
    remainingCategories,
    remainingSettings,
  };
}
