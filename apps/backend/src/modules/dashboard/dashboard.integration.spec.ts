import { PrismaService } from '../../database/prisma.service';
import { TransactionType } from '../../generated/prisma/client';
import { PrismaDashboardRepository } from './repositories/prisma-dashboard.repository';
import { DashboardService } from './services/dashboard.service';

const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Dashboard integration - currency isolation (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let service: DashboardService | null = null;
  let userId: string;
  let usdAccountId: string;
  let idrAccountId: string;
  let usdExpenseTxId: string;
  let usdIncomeTxId: string;
  let idrExpenseTxId: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log('Skipping dashboard integration tests: DATABASE_URL not configured');
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();

    const user = await prisma.user.create({
      data: {
        email: `dashboard-int-${Date.now()}@example.com`,
        username: `dashboard_int_${Date.now()}`,
        full_name: 'Dashboard Integration User',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;

    const usdCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `USD Dashboard Cat ${Date.now()}`,
        type: 'expense',
      },
    });
    const idrCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `IDR Dashboard Cat ${Date.now() + 1}`,
        type: 'expense',
      },
    });
    const incomeCategory = await prisma.category.create({
      data: {
        user_id: userId,
        name: `USD Income Cat ${Date.now() + 2}`,
        type: 'income',
      },
    });

    const usdAccount = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'USD Cash',
        account_type: 'cash',
        currency: 'USD',
        current_balance_cents: BigInt(150000),
        is_default: true,
      },
    });
    const idrAccount = await prisma.account.create({
      data: {
        user_id: userId,
        name: 'IDR Cash',
        account_type: 'cash',
        currency: 'IDR',
        current_balance_cents: BigInt(2500000),
      },
    });
    usdAccountId = usdAccount.id;
    idrAccountId = idrAccount.id;

    const usdIncome = await prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: usdAccountId,
        category_id: incomeCategory.id,
        transaction_type: TransactionType.INCOME,
        amount_cents: BigInt(90000),
        transaction_date: new Date(),
        note: 'USD income',
      },
    });
    const usdExpense = await prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: usdAccountId,
        category_id: usdCategory.id,
        transaction_type: TransactionType.EXPENSE,
        amount_cents: BigInt(40000),
        transaction_date: new Date(),
        note: 'USD expense',
      },
    });
    const idrExpense = await prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: idrAccountId,
        category_id: idrCategory.id,
        transaction_type: TransactionType.EXPENSE,
        amount_cents: BigInt(6000000),
        transaction_date: new Date(),
        note: 'IDR expense',
      },
    });

    usdIncomeTxId = usdIncome.id;
    usdExpenseTxId = usdExpense.id;
    idrExpenseTxId = idrExpense.id;

    const repo = new PrismaDashboardRepository(prisma as any);
    service = new DashboardService(repo);
  }, 20000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;

    try {
      await prisma.transaction.deleteMany({
        where: { user_id: userId },
      });
      await prisma.category.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
      console.warn('Dashboard cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Dashboard summary for USD excludes IDR-ledger rows', async () => {
    if (!hasDatabase || !service) return;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    const summary = await service.getSummaryForUser(userId, 'USD');
    const byCurrency = summary.by_currency ?? [];

    expect(summary.currency).toBe('USD');
    expect(byCurrency.every((row) => row.currency === 'USD')).toBe(true);
    expect(summary.total_income_cents).toBe('90000');
    expect(summary.total_expense_cents).toBe('40000');
    expect(summary.net_cash_flow_cents).toBe('50000');
    expect(summary.total_accounts).toBeGreaterThanOrEqual(1);

    const usdTxs = await prisma!.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        account: { currency: 'USD' },
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
    });
    const idrTxs = await prisma!.transaction.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        account: { currency: 'IDR' },
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
    });

    expect(usdTxs.some((tx) => tx.id === usdIncomeTxId || tx.id === usdExpenseTxId)).toBe(true);
    expect(idrTxs.some((tx) => tx.id === idrExpenseTxId)).toBe(true);
    expect(summary.total_expense_cents).not.toBe('6000000');
  });
});
