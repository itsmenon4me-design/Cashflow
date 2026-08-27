import { PrismaService } from '../../database/prisma.service';
import { PrismaAccountsRepository } from './repositories/prisma-accounts.repository';
import { AccountsService } from './services/accounts.service';

// Integration tests for:
//  - soft-delete account name uniqueness (partial unique index on active rows)
//  - cross-user access rejection and per-user name scoping
// Skips when DATABASE_URL is not provided.
const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Accounts Integration - soft-delete name uniqueness & user isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let repo: PrismaAccountsRepository | null = null;
  let svc: AccountsService | null = null;
  let auditMock: any;
  let balanceMock: any;
  let userId: string;
  let seededAccountId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping accounts integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();
    repo = new PrismaAccountsRepository(prisma as any);
    // minimal audit/balance mocks
    auditMock = { record: jest.fn().mockResolvedValue(undefined) };
    balanceMock = { recalculateAccount: jest.fn().mockResolvedValue(undefined) };
    svc = new AccountsService(repo as any, auditMock, balanceMock);

    // create a test user
    const user = await prisma.user.create({
      data: {
        email: `acc-int-${Date.now()}@example.com`,
        username: `accint_${Date.now()}`,
        full_name: 'Acc Integration User',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    const seeded = await svc.create(userId, { name: 'Seed Account Int' } as any);
    seededAccountId = seeded.id;
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;
    try {
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      console.warn('Cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Active duplicate account name is rejected', async () => {
    if (!hasDatabase || !svc) return;

    // 'Seed Account Int' already exists and is active -> CONFLICT
    await expect(
      svc.create(userId, { name: 'Seed Account Int' } as any),
    ).rejects.toThrow();
  });

  test('Soft-deleted account name can be reused (partial unique index)', async () => {
    if (!hasDatabase || !svc) return;

    const name = `Reuse-${Date.now()}`;

    // create via service, then soft-delete it
    const first = await svc.create(userId, { name } as any);
    expect(first.name).toBe(name);
    await svc.softDelete(userId, first.id);

    // soft-deleted row must not block recreating the same name
    const second = await svc.create(userId, { name } as any);
    expect(second.id).not.toBe(first.id);
    expect(second.name).toBe(name);

    // two ACTIVE accounts with the same name must remain impossible
    await expect(
      svc.create(userId, { name } as any),
    ).rejects.toThrow();

    await svc.softDelete(userId, second.id);
  });

  test('Cross-user access is rejected; account names are per-user', async () => {
    if (!hasDatabase || !prisma) return;

    // create a second user
    const uB = await prisma.user.create({
      data: {
        email: `acc-int-b-${Date.now()}@example.com`,
        username: `accintb_${Date.now()}`,
        full_name: 'Acc Integration User B',
        password_hash: 'x',
        status: 'active',
      },
    });

    try {
      const bSvc = new AccountsService(
        new PrismaAccountsRepository(prisma as any) as any,
        auditMock,
        balanceMock,
      );

      // user B cannot read, update or delete user A's account
      await expect(bSvc.getById(uB.id, seededAccountId)).rejects.toThrow();
      await expect(
        bSvc.update(uB.id, seededAccountId, { name: 'X' } as any),
      ).rejects.toThrow();
      await expect(bSvc.softDelete(uB.id, seededAccountId)).rejects.toThrow();

      // user B may reuse user A's account name (names are scoped per user)
      const bAccount = await bSvc.create(uB.id, {
        name: 'Seed Account Int',
      } as any);
      expect(bAccount.name).toBe('Seed Account Int');
      expect(bAccount.user_id).toBe(uB.id);
    } finally {
      // cleanup user B (also on assertion failure)
      await prisma.account.deleteMany({ where: { user_id: uB.id } });
      await prisma.user.delete({ where: { id: uB.id } });
    }
  });
});
