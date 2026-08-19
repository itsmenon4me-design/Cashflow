import { PrismaService } from '../../database/prisma.service';
import { PrismaAccountsRepository } from './repositories/prisma-accounts.repository';
import { AccountsService } from './services/accounts.service';

// Integration tests for:
//  - account isolation by currency (IDR/USD/SGD/EUR)
//  - soft-delete account name uniqueness (partial unique index on active rows)
//  - cross-user access rejection and per-user name scoping
// Skips when DATABASE_URL is not provided.
const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Accounts Integration - currency isolation & soft-delete name uniqueness (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let repo: PrismaAccountsRepository | null = null;
  let svc: AccountsService | null = null;
  let auditMock: any;
  let balanceMock: any;
  let userId: string;
  let idrAccountId: string;
  let usdAccountId: string;
  let sgdAccountId: string;
  let eurAccountId: string;

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

    const mk = async (name: string, currency: string) => {
      const rec = await prisma!.account.create({
        data: {
          user_id: userId,
          name,
          account_type: 'CASH',
          currency,
        },
      });
      return rec.id;
    };

    idrAccountId = await mk('IDR Account Int', 'IDR');
    usdAccountId = await mk('USD Account Int', 'USD');
    sgdAccountId = await mk('SGD Account Int', 'SGD');
    eurAccountId = await mk('EUR Account Int', 'EUR');
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

  test('Accounts list filtered by currency (IDR/USD/SGD/EUR isolation intact)', async () => {
    if (!hasDatabase || !svc) return;

    const idrList = await svc.listAll(userId, 'IDR');
    const usdList = await svc.listAll(userId, 'USD');
    const sgdList = await svc.listAll(userId, 'SGD');
    const eurList = await svc.listAll(userId, 'EUR');
    const allList = await svc.listAll(userId);

    expect(idrList.some((a) => a.id === idrAccountId)).toBe(true);
    expect(idrList.every((a) => a.currency === 'IDR')).toBe(true);

    expect(usdList.some((a) => a.id === usdAccountId)).toBe(true);
    expect(usdList.every((a) => a.currency === 'USD')).toBe(true);

    expect(sgdList.some((a) => a.id === sgdAccountId)).toBe(true);
    expect(sgdList.every((a) => a.currency === 'SGD')).toBe(true);

    expect(eurList.some((a) => a.id === eurAccountId)).toBe(true);
    expect(eurList.every((a) => a.currency === 'EUR')).toBe(true);

    expect(allList.some((a) => a.id === idrAccountId)).toBe(true);
    expect(allList.some((a) => a.id === usdAccountId)).toBe(true);
  });

  test('Cross-currency detail/update/delete are rejected/not found', async () => {
    if (!hasDatabase || !svc) return;

    // get with wrong currency should be NOT_FOUND
    await expect(svc.getById(userId, idrAccountId, 'USD')).rejects.toThrow();

    // update with wrong currency should be rejected
    await expect(svc.update(userId, idrAccountId, { name: 'X' } as any, 'USD')).rejects.toThrow();

    // delete with wrong currency should be rejected
    await expect(svc.softDelete(userId, idrAccountId, 'USD')).rejects.toThrow();
  });

  test('Active duplicate account name is rejected', async () => {
    if (!hasDatabase || !svc) return;

    // 'IDR Account Int' already exists and is active -> CONFLICT
    await expect(
      svc.create(userId, { name: 'IDR Account Int', currency: 'IDR' } as any),
    ).rejects.toThrow();

    // Same name in another currency still occupies the same per-user name slot:
    // the partial unique index enforces (user_id, name) among active rows,
    // regardless of currency -> also rejected.
    await expect(
      svc.create(userId, { name: 'IDR Account Int', currency: 'USD' } as any),
    ).rejects.toThrow();
  });

  test('Soft-deleted account name can be reused (partial unique index)', async () => {
    if (!hasDatabase || !svc || !prisma) return;

    const name = `Reuse-${Date.now()}`;

    // create via service, then soft-delete it
    const first = await svc.create(userId, { name, currency: 'IDR' } as any);
    expect(first.name).toBe(name);
    await svc.softDelete(userId, first.id, 'IDR');

    // soft-deleted row must not block recreating the same name
    const second = await svc.create(userId, { name, currency: 'IDR' } as any);
    expect(second.id).not.toBe(first.id);
    expect(second.name).toBe(name);

    // two ACTIVE accounts with the same name must remain impossible
    await expect(
      svc.create(userId, { name, currency: 'IDR' } as any),
    ).rejects.toThrow();

    await svc.softDelete(userId, second.id, 'IDR');
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

      // user B cannot read, update or delete user A's account (even with the
      // correct currency)
      await expect(bSvc.getById(uB.id, idrAccountId, 'IDR')).rejects.toThrow();
      await expect(
        bSvc.update(uB.id, idrAccountId, { name: 'X' } as any, 'IDR'),
      ).rejects.toThrow();
      await expect(bSvc.softDelete(uB.id, idrAccountId, 'IDR')).rejects.toThrow();

      // user B may reuse user A's account name (names are scoped per user)
      const bAccount = await bSvc.create(uB.id, {
        name: 'IDR Account Int',
        currency: 'IDR',
      } as any);
      expect(bAccount.name).toBe('IDR Account Int');
      expect(bAccount.user_id).toBe(uB.id);
    } finally {
      // cleanup user B (also on assertion failure)
      await prisma.account.deleteMany({ where: { user_id: uB.id } });
      await prisma.user.delete({ where: { id: uB.id } });
    }
  });
});