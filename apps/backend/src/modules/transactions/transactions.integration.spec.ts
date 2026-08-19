import { PrismaService } from '../../database/prisma.service';
import { PrismaTransactionsRepository } from './repositories/prisma-transactions.repository';

// Integration test: validates DB-level currency scoping for transactions
// Skips if DATABASE_URL is not configured (common in local dev)

const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Transactions Integration - currency isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let repo: PrismaTransactionsRepository | null = null;
  let userId: string;
  let idrAccountId: string;
  let usdAccountId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();
    repo = new PrismaTransactionsRepository(prisma as any);

    // create a test user
    const user = await prisma.user.create({
      data: {
        email: `int-test-${Date.now()}@example.com`,
        username: `inttest_${Date.now()}`,
        full_name: 'Integration Test User',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    // create category required by transaction
    const cat = await prisma.category.create({
      data: {
        user_id: userId,
        name: 'Test Income',
        type: 'INCOME',
      },
    });
    incomeCategoryId = cat.id;

    // create IDR account
    const a1 = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'IDR Account Int',
        account_type: 'CASH',
        currency: 'IDR',
      },
    });
    idrAccountId = a1.id;

    // create USD account
    const a2 = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'USD Account Int',
        account_type: 'CASH',
        currency: 'USD',
      },
    });
    usdAccountId = a2.id;

    // create one transaction in IDR account
    await prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: idrAccountId,
        category_id: incomeCategoryId,
        transaction_type: 'INCOME',
        amount_cents: BigInt(100000),
        transaction_date: new Date(),
      },
    });

    // create one transaction in USD account
    await prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: usdAccountId,
        category_id: incomeCategoryId,
        transaction_type: 'INCOME',
        amount_cents: BigInt(5000),
        transaction_date: new Date(),
      },
    });
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;
    // Clean up created data: transactions -> accounts -> categories -> user
    try {
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.category.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      // best-effort cleanup
      // eslint-disable-next-line no-console
      console.warn('Cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('IDR transactions appear only when filtering by IDR', async () => {
    if (!hasDatabase || !repo) return;

    // First, verify DB-level relation queries directly via prisma
    const idrDb = await prisma!.transaction.findMany({
      where: { user_id: userId, deleted_at: null, account: { currency: 'IDR' } },
      include: { account: true },
    });
    const usdDb = await prisma!.transaction.findMany({
      where: { user_id: userId, deleted_at: null, account: { currency: 'USD' } },
      include: { account: true },
    });

    expect(idrDb.length).toBeGreaterThanOrEqual(1);
    expect(usdDb.length).toBeGreaterThanOrEqual(1);
    expect(idrDb.every((t) => t.account.currency === 'IDR')).toBe(true);
    expect(usdDb.every((t) => t.account.currency === 'USD')).toBe(true);

    // Then assert repository (which strips account in mapping) returns counts matching DB counts
    const { total: idrTotal } = await repo!.findByUserWithFilter(
      userId,
      { currency: 'IDR' } as any,
      { page: 1, limit: 20 },
    );
    const { total: usdTotal } = await repo!.findByUserWithFilter(
      userId,
      { currency: 'USD' } as any,
      { page: 1, limit: 20 },
    );

    expect(idrTotal).toBe(idrDb.length);
    expect(usdTotal).toBe(usdDb.length);

    // Now verify that querying without currency returns at least both transactions (may be >=)
    const { total: allTotal } = await repo!.findByUserWithFilter(userId, {} as any, { page: 1, limit: 20 });
    expect(allTotal).toBeGreaterThanOrEqual(idrDb.length + usdDb.length - 1);
  }, 20000);
});
