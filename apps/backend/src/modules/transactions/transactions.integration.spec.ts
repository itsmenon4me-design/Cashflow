import { PrismaService } from '../../database/prisma.service';
import { PrismaTransactionsRepository } from './repositories/prisma-transactions.repository';

// Integration test: verifies user-scoped transaction isolation
// Skips if DATABASE_URL is not configured (common in local dev)

const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;
const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('Transactions Integration - user isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let repo: PrismaTransactionsRepository | null = null;
  let userAId: string;
  let userBId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();
    repo = new PrismaTransactionsRepository(prisma as any);

    const mkUser = async (suffix: string) => {
      const user = await prisma!.user.create({
        data: {
          email: `int-test-${suffix}-${Date.now()}@example.com`,
          username: `inttest_${suffix}_${Date.now()}`,
          full_name: 'Integration Test User',
          password_hash: 'x',
          status: 'active',
        },
      });
      return user.id;
    };
    userAId = await mkUser('a');
    userBId = await mkUser('b');

    const cat = await prisma.category.create({
      data: {
        user_id: userAId,
        name: 'Test Income',
        type: 'INCOME',
      },
    });
    incomeCategoryId = cat.id;

    const mkTx = (userId: string, amount: bigint) =>
      prisma!.transaction.create({
        data: {
          user_id: userId,
          category_id: incomeCategoryId,
          transaction_type: 'INCOME',
          amount_cents: amount,
          transaction_date: new Date(),
        },
      });

    await mkTx(userAId, BigInt(100000));
    await mkTx(userBId, BigInt(5000));
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;
    try {
      await prisma.transaction.deleteMany({
        where: { user_id: { in: [userAId, userBId] } },
      });
      await prisma.category.deleteMany({ where: { id: incomeCategoryId } });
      await prisma.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
    } catch (err) {
      console.warn('Cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('transactions are scoped to their owning user', async () => {
    if (!hasDatabase || !repo) return;

    const userATotal = (
      await repo!.findByUserWithFilter(userAId, {} as any, { page: 1, limit: 20 })
    ).total;
    const allTotal = (
      await repo!.findByUserWithFilter(userAId, {} as any, { page: 1, limit: 20 })
    ).total;

    expect(userATotal).toBeGreaterThanOrEqual(1);
    expect(allTotal).toBe(userATotal);

    const userARecs = (
      await repo!.findByUserWithFilter(userAId, {} as any, { page: 1, limit: 20 })
    ).items;
    expect(userARecs.every((t) => t.user_id === userAId)).toBe(true);
  }, 20000);
});
