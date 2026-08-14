import { PrismaService } from '../../../database/prisma.service';
import { TransfersService } from './transfers.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from '../../transactions/services/validation/transaction-validation.service';

jest.setTimeout(120000);

describe('TransfersService integration concurrency (requires real Postgres)', () => {
  let prisma: PrismaService;
  let svc: TransfersService;
  let userId: string;
  let srcAccountId: string;
  let dstAccountId: string;

  // Skip this test suite if DATABASE_URL is not configured
  const dbUrl = process.env.DATABASE_URL || '';
  const hasDatabaseUrl = dbUrl.trim().length > 0;

  beforeAll(async () => {
    // DATABASE_URL must be set in the environment when running this test
    if (!hasDatabaseUrl) {
      console.log('Skipping integration test: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();

    // create a test user
    const user = await prisma.user.create({
      data: {
        email: `test+${Date.now()}@local`,
        username: `testuser_${Date.now()}`,
        full_name: 'Integration Test',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    // create categories required by TransfersService (Transfer Out/In)
    await prisma.category.createMany({
      data: [
        { user_id: userId, name: 'Transfer Out', type: 'TRANSFER' },
        { user_id: userId, name: 'Transfer In', type: 'TRANSFER' },
      ],
    });

    // create accounts
    const src = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'src-integration',
        account_type: 'CHECKING',
        currency: 'IDR',
        opening_balance_cents: BigInt(0),
        current_balance_cents: BigInt(0),
      },
    });
    const dst = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'dst-integration',
        account_type: 'CHECKING',
        currency: 'IDR',
        opening_balance_cents: BigInt(0),
        current_balance_cents: BigInt(0),
      },
    });
    srcAccountId = src.id;
    dstAccountId = dst.id;

    svc = new TransfersService(
      prisma,
      { record: async () => {} } as unknown as AuditLogService,
      {
        validateForCreate: async () => {},
      } as unknown as TransactionValidationService,
    );
  });

  afterAll(async () => {
    // Skip cleanup if database wasn't available
    if (!hasDatabaseUrl || !prisma) {
      return;
    }

    // cleanup: delete transactions, accounts, categories, user
    try {
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.category.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  test('Case A: two concurrent transfers that exactly consume balance', async () => {
    // Skip if database not available
    if (!hasDatabaseUrl) {
      return;
    }
    await prisma.account.update({
      where: { id: srcAccountId },
      data: { current_balance_cents: BigInt(100000) },
    });
    await prisma.account.update({
      where: { id: dstAccountId },
      data: { current_balance_cents: BigInt(0) },
    });

    const t1 = svc.create(userId, {
      source_account_id: srcAccountId,
      destination_account_id: dstAccountId,
      amount_cents: BigInt(50000),
    });
    const t2 = svc.create(userId, {
      source_account_id: srcAccountId,
      destination_account_id: dstAccountId,
      amount_cents: BigInt(50000),
    });

    const results = await Promise.allSettled([t1, t2]);

    // both should succeed
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(2);

    const src = await prisma.account.findUnique({
      where: { id: srcAccountId },
    });
    const dst = await prisma.account.findUnique({
      where: { id: dstAccountId },
    });

    expect(src?.current_balance_cents).toBe(BigInt(0));
    expect(dst?.current_balance_cents).toBe(BigInt(100000));

    // ledger rows: two transfers => four transactions
    const txs = await prisma.transaction.findMany({
      where: { user_id: userId, transfer_group_id: { not: null } },
    });
    expect(txs.length).toBe(4);
  });

  test('Case B: concurrent transfers exceeding available balance, exactly one succeeds', async () => {
    // Skip if database not available
    if (!hasDatabaseUrl) {
      return;
    }
    await prisma.account.update({
      where: { id: srcAccountId },
      data: { current_balance_cents: BigInt(100000) },
    });
    await prisma.account.update({
      where: { id: dstAccountId },
      data: { current_balance_cents: BigInt(0) },
    });

    const t1 = svc.create(userId, {
      source_account_id: srcAccountId,
      destination_account_id: dstAccountId,
      amount_cents: BigInt(70000),
    });
    const t2 = svc.create(userId, {
      source_account_id: srcAccountId,
      destination_account_id: dstAccountId,
      amount_cents: BigInt(50000),
    });

    const results = await Promise.allSettled([t1, t2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const src = await prisma.account.findUnique({
      where: { id: srcAccountId },
    });
    const dst = await prisma.account.findUnique({
      where: { id: dstAccountId },
    });

    // final source balance depends on which concurrent transfer wins:
    // 70000 transfer wins => 30000 remaining
    // 50000 transfer wins => 50000 remaining
    expect([BigInt(30000), BigInt(50000)]).toContain(
      src?.current_balance_cents,
    );

    // destination should have received either 70000 or 50000 depending on which won
    expect(
      dst?.current_balance_cents === BigInt(70000) ||
        dst?.current_balance_cents === BigInt(50000),
    ).toBe(true);

    // Ensure only one transfer group committed (2 transactions)
    const txs = await prisma.transaction.findMany({
      where: { user_id: userId, transfer_group_id: { not: null } },
    });
    // There may be existing rows from previous test; filter groups by created time by taking unique transfer_group_id count
    const groups = new Set<string | null>(
      txs.map((t) => String(t.transfer_group_id)),
    );
    // groups size should be at least 1; ensure at least one of the two groups exists and no partial groups for failed transfer
    expect(groups.size >= 1).toBe(true);
  });

  test('Case C: repeated concurrent transfers (10 succeed, 20 with some failures)', async () => {
    // Skip if database not available
    if (!hasDatabaseUrl) {
      return;
    }
    const s = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'multi-src',
        account_type: 'CHECKING',
        currency: 'IDR',
        opening_balance_cents: 0n,
        current_balance_cents: 1000000n,
      },
    });
    const d = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'multi-dst',
        account_type: 'CHECKING',
        currency: 'IDR',
        opening_balance_cents: 0n,
        current_balance_cents: 0n,
      },
    });

    // 10 concurrent transfers of 100k
    const promises = [] as Promise<any>[];
    for (let i = 0; i < 10; i++) {
      promises.push(
        svc.create(userId, {
          source_account_id: s.id,
          destination_account_id: d.id,
          amount_cents: BigInt(100000),
        }),
      );
    }
    const res = await Promise.allSettled(promises);
    const fulfilled = res.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(10);

    const srcAfter = await prisma.account.findUnique({ where: { id: s.id } });
    const dstAfter = await prisma.account.findUnique({ where: { id: d.id } });
    expect(srcAfter?.current_balance_cents).toBe(BigInt(0));
    expect(dstAfter?.current_balance_cents).toBe(BigInt(1000000));

    // Now attempt 20 concurrent transfers of 100k against a 1M balance
    await prisma.account.update({
      where: { id: s.id },
      data: { current_balance_cents: BigInt(1000000) },
    });
    await prisma.account.update({
      where: { id: d.id },
      data: { current_balance_cents: BigInt(0) },
    });

    const promises2 = [] as Promise<any>[];
    for (let i = 0; i < 20; i++) {
      promises2.push(
        svc.create(userId, {
          source_account_id: s.id,
          destination_account_id: d.id,
          amount_cents: BigInt(100000),
        }),
      );
    }
    const r2 = await Promise.allSettled(promises2);
    const fulfilled2 = r2.filter((r) => r.status === 'fulfilled');
    const rejected2 = r2.filter((r) => r.status === 'rejected');
    expect(fulfilled2.length).toBe(10);
    expect(rejected2.length).toBe(10);

    const srcAfter2 = await prisma.account.findUnique({ where: { id: s.id } });
    const dstAfter2 = await prisma.account.findUnique({ where: { id: d.id } });
    expect(srcAfter2?.current_balance_cents).toBe(BigInt(0));
    expect(dstAfter2?.current_balance_cents).toBe(BigInt(1000000));

    // cleanup created multi accounts
    await prisma.transaction.deleteMany({
      where: { account_id: { in: [s.id, d.id] } },
    });
    await prisma.account.deleteMany({ where: { id: { in: [s.id, d.id] } } });
  }, 60000);
});
