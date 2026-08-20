import { PrismaService } from '../../database/prisma.service';
import { PrismaBillsRepository } from './repositories/prisma-bills.repository';
import { BillsService } from './services/bills.service';

// Integration tests for DB-level currency isolation for bills
// Skips when DATABASE_URL is not provided.
const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Bills Integration - currency isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let repo: PrismaBillsRepository | null = null;
  let svc: BillsService | null = null;
  let userId: string;
  let idrBillId: string;
  let usdBillId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping bills integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();
    repo = new PrismaBillsRepository(prisma as any);
    svc = new BillsService(repo as any, prisma as any);

    const user = await prisma.user.create({
      data: {
        email: `bills-int-${Date.now()}@example.com`,
        username: `billsint_${Date.now()}`,
        full_name: 'Bills Integration User',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    const mk = async (amount: number, currency: string) => {
      const rec = await prisma!.bill.create({
        data: {
          user_id: userId,
          payee: `Payee ${currency}`,
          amount_cents: BigInt(amount),
          currency,
          account_id: '',
          category_id: '',
          due_date: new Date(),
          due_date_timezone: 'UTC',
        },
      });
      return rec.id;
    };

    idrBillId = await mk(10000, 'IDR');
    usdBillId = await mk(5000, 'USD');
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;
    try {
      await prisma.bill.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      console.warn('Cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Bills list filtered by currency (IDR vs USD)', async () => {
    if (!hasDatabase || !svc) return;

    const idrList = await svc.list(userId, 'IDR');
    const usdList = await svc.list(userId, 'USD');
    const allList = await svc.list(userId);

    expect(idrList.some((b) => b.id === idrBillId)).toBe(true);
    expect(idrList.every((b) => b.currency === 'IDR')).toBe(true);

    expect(usdList.some((b) => b.id === usdBillId)).toBe(true);
    expect(usdList.every((b) => b.currency === 'USD')).toBe(true);

    expect(allList.some((b) => b.id === idrBillId)).toBe(true);
    expect(allList.some((b) => b.id === usdBillId)).toBe(true);
  });

  test('Cross-currency detail is NOT FOUND', async () => {
    if (!hasDatabase || !svc) return;

    await expect(svc.getById(userId, idrBillId, 'USD')).rejects.toThrow();
  });
});
