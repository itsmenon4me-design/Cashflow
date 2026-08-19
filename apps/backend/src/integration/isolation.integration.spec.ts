import { PrismaService } from '../database/prisma.service';
import { PrismaTransactionsRepository } from '../modules/transactions/repositories/prisma-transactions.repository';
import { TransactionsService } from '../modules/transactions/services/transactions.service';
import { MonthlyReportService } from '../modules/reports/services/monthly-report.service';
import { CategoryBreakdownService } from '../modules/reports/services/category-breakdown.service';
import { CashflowTrendService } from '../modules/reports/services/cashflow-trend.service';
import { AnalyticsService } from '../modules/analytics/services/analytics.service';
import { PrismaDashboardRepository } from '../modules/dashboard/repositories/prisma-dashboard.repository';
import { DashboardService } from '../modules/dashboard/services/dashboard.service';
import { TransactionType } from '../generated/prisma/client';

// Integration tests for currency-scoped isolation (detail/update/delete, search,
// reports, analytics, dashboard summary, authorization, account mutation).
// Skips when DATABASE_URL is not provided.
const dbUrl = process.env.DATABASE_URL || '';
const hasDatabase = dbUrl.trim().length > 0;

describe('Isolation Integration - currency scope & authorization (DB-level)', () => {
  let prisma: PrismaService | null = null;
  let txRepo: PrismaTransactionsRepository | null = null;
  let txService: TransactionsService | null = null;
  let monthly: MonthlyReportService | null = null;
  let analytics: AnalyticsService | null = null;
  let dashboard: DashboardService | null = null;

  let userA: string;
  let userB: string;
  let idrAcc: string;
  let usdAcc: string;
  let accB: string;
  let expenseCatA: string;
  let incomeCatA: string;
  let idrTx: string;
  let usdTx: string;
  let txB: string;

  beforeAll(async () => {
    if (!hasDatabase) {
      console.log(
        'Skipping isolation integration tests: DATABASE_URL not configured',
      );
      return;
    }

    prisma = new PrismaService();
    await prisma.$connect();
    txRepo = new PrismaTransactionsRepository(prisma as any);

    const auditMock: any = { record: jest.fn().mockResolvedValue(undefined) };
    const validatorMock: any = {
      validateForUpdate: jest.fn().mockResolvedValue(undefined),
      validateForCreate: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsMock: any = {
      notifyTransactionCreated: jest.fn().mockResolvedValue(undefined),
    };
    const balanceMock: any = {
      recalculateAccount: jest.fn().mockResolvedValue(undefined),
    };
    const financeBotMock: any = {
      evaluate: jest.fn().mockResolvedValue(undefined),
    };
    txService = new TransactionsService(
      txRepo as any,
      auditMock,
      validatorMock,
      notificationsMock,
      balanceMock,
      financeBotMock,
    );

    monthly = new MonthlyReportService(prisma as any);
    const cb = new CategoryBreakdownService(prisma as any);
    const ct = new CashflowTrendService(prisma as any);
    analytics = new AnalyticsService(
      prisma as any,
      monthly as any,
      cb as any,
      ct as any,
    );
    dashboard = new DashboardService(
      new PrismaDashboardRepository(prisma as any) as any,
    );

    const now = Date.now();
    const uA = await prisma.user.create({
      data: {
        email: `iso-a-${now}@example.com`,
        username: `isoa_${now}`,
        full_name: 'Isolation A',
        password_hash: 'x',
        status: 'active',
      },
    });
    const uB = await prisma.user.create({
      data: {
        email: `iso-b-${now}@example.com`,
        username: `isob_${now}`,
        full_name: 'Isolation B',
        password_hash: 'x',
        status: 'active',
      },
    });
    userA = uA.id;
    userB = uB.id;

    const idr = await prisma.account.create({
      data: {
        user_id: userA,
        name: 'IDR Iso Acc',
        account_type: 'CASH',
        currency: 'IDR',
      },
    });
    idrAcc = idr.id;
    const usd = await prisma.account.create({
      data: {
        user_id: userA,
        name: 'USD Iso Acc',
        account_type: 'CASH',
        currency: 'USD',
      },
    });
    usdAcc = usd.id;
    const bAcc = await prisma.account.create({
      data: {
        user_id: userB,
        name: 'IDR Iso Acc B',
        account_type: 'CASH',
        currency: 'IDR',
      },
    });
    accB = bAcc.id;

    const eCat = await prisma.category.create({
      data: { user_id: userA, name: 'Iso Expense', type: 'EXPENSE' },
    });
    expenseCatA = eCat.id;
    const iCat = await prisma.category.create({
      data: { user_id: userA, name: 'Iso Income', type: 'INCOME' },
    });
    incomeCatA = iCat.id;

    const tx = (accountId: string, type: TransactionType, cents: bigint) =>
      prisma!.transaction.create({
        data: {
          user_id: userA,
          account_id: accountId,
          category_id: type === TransactionType.EXPENSE ? expenseCatA : incomeCatA,
          transaction_type: type,
          amount_cents: cents,
          transaction_date: new Date(),
          note: `iso-${type}-${cents.toString()}`,
        },
      });

    idrTx = (await tx(idrAcc, TransactionType.EXPENSE, 250000n)).id;
    usdTx = (await tx(usdAcc, TransactionType.EXPENSE, 250000n)).id;
    await tx(idrAcc, TransactionType.INCOME, 500000n);
    await tx(usdAcc, TransactionType.INCOME, 500000n);

    txB = (
      await prisma.transaction.create({
        data: {
          user_id: userB,
          account_id: accB,
          category_id: (
            await prisma.category.create({
              data: { user_id: userB, name: 'Iso B Cat', type: 'EXPENSE' },
            })
          ).id,
          transaction_type: TransactionType.EXPENSE,
          amount_cents: 99999n,
          transaction_date: new Date(),
          note: `iso-b-${now}`,
        },
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    if (!hasDatabase || !prisma) return;
    try {
      await prisma.transaction.deleteMany({ where: { user_id: userA } });
      await prisma.transaction.deleteMany({ where: { user_id: userB } });
      await prisma.account.deleteMany({ where: { user_id: userA } });
      await prisma.account.deleteMany({ where: { user_id: userB } });
      await prisma.category.deleteMany({ where: { user_id: userA } });
      await prisma.category.deleteMany({ where: { user_id: userB } });
      await prisma.user.delete({ where: { id: userA } });
      await prisma.user.delete({ where: { id: userB } });
    } catch (err) {
      console.warn('Cleanup failed', err);
    } finally {
      await prisma.$disconnect();
    }
  });

  test('Transaction detail is currency-scoped', async () => {
    if (!hasDatabase || !txRepo) return;

    const viaIdr = await txRepo.findById(idrTx, 'IDR');
    expect(viaIdr?.id).toBe(idrTx);

    const wrongCurrency = await txRepo.findById(idrTx, 'USD');
    expect(wrongCurrency).toBeNull();
  });

  test('Transaction update/delete are rejected across currency scopes', async () => {
    if (!hasDatabase || !txService || !prisma) return;

    // dedicated fixture: must not soft-delete shared idrTx, which later tests
    // (search, monthly report, analytics, dashboard) still assert on.
    const victim = await prisma.transaction.create({
      data: {
        user_id: userA,
        account_id: idrAcc,
        category_id: expenseCatA,
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 11111n,
        transaction_date: new Date(),
        note: 'iso-delete-victim',
      },
    });

    await expect(
      txService.update(userA, victim.id, { note: 'hacked' } as any, undefined, 'USD'),
    ).rejects.toThrow();

    await expect(
      txService.softDelete(userA, victim.id, 'USD'),
    ).rejects.toThrow();

    await txService.softDelete(userA, victim.id, 'IDR');
    const afterDelete = await txRepo?.findById(victim.id, 'IDR');
    expect(afterDelete).toBeNull();
  });

  test('Transaction search is currency-scoped', async () => {
    if (!hasDatabase || !txRepo) return;

    const idrHits = await txRepo.searchByUser(
      userA,
      'iso-EXPENSE',
      { page: 1, limit: 50 },
      'IDR',
    );
    expect(idrHits.items.length).toBeGreaterThan(0);
    expect(idrHits.items.every((t) => t.account_id === idrAcc)).toBe(true);

    const usdHits = await txRepo.searchByUser(
      userA,
      'iso-EXPENSE',
      { page: 1, limit: 50 },
      'USD',
    );
    expect(usdHits.items.length).toBeGreaterThan(0);
    expect(usdHits.items.every((t) => t.account_id === usdAcc)).toBe(true);
  });

  test('Monthly report aggregates only the requested currency', async () => {
    if (!hasDatabase || !monthly) return;

    const idr = await monthly.getMonthlyReport(
      userA,
      new Date().getMonth() + 1,
      new Date().getFullYear(),
      undefined,
      'IDR',
    );
    const usd = await monthly.getMonthlyReport(
      userA,
      new Date().getMonth() + 1,
      new Date().getFullYear(),
      undefined,
      'USD',
    );

    expect(idr.summary.expense).toBe('250000');
    expect(idr.summary.income).toBe('500000');
    expect(usd.summary.expense).toBe('250000');
    expect(usd.summary.income).toBe('500000');
  });

  test('Analytics cashflow is currency-scoped', async () => {
    if (!hasDatabase || !analytics) return;

    const idr = await analytics.cashflow(userA, {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
      endDate: new Date().toISOString(),
      currency: 'IDR',
    } as any);
    const usd = await analytics.cashflow(userA, {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
      endDate: new Date().toISOString(),
      currency: 'USD',
    } as any);

    expect(idr.totalExpense).toBe('250000');
    expect(idr.totalIncome).toBe('500000');
    expect(usd.totalExpense).toBe('250000');
    expect(usd.totalIncome).toBe('500000');
  });

  test('Dashboard summary is currency-scoped', async () => {
    if (!hasDatabase || !dashboard) return;

    const idr = await dashboard.getSummaryForUser(userA, 'IDR');
    const usd = await dashboard.getSummaryForUser(userA, 'USD');

    expect(idr.total_expense_cents).toBe('250000');
    expect(idr.total_income_cents).toBe('500000');
    expect(usd.total_expense_cents).toBe('250000');
    expect(usd.total_income_cents).toBe('500000');
  });

  test('Authorization: user B cannot access user A transaction', async () => {
    if (!hasDatabase || !txService) return;

    await expect(
      txService.getById(userB, idrTx, 'IDR'),
    ).rejects.toThrow();

    await expect(
      txService.update(userB, idrTx, { note: 'x' } as any, undefined, 'IDR'),
    ).rejects.toThrow();

    await expect(
      txService.softDelete(userB, usdTx, 'USD'),
    ).rejects.toThrow();
  });

  test('Account mutation does not leak across users', async () => {
    if (!hasDatabase || !prisma || !txService) return;

    // user A soft-deletes their IDR transaction; user B's data must be unaffected.
    const before = await txRepo!.searchByUser(
      userB,
      'iso-b',
      { page: 1, limit: 50 },
      'IDR',
    );
    expect(before.items.some((t) => t.id === txB)).toBe(true);

    await txService.softDelete(userA, usdTx, 'USD');

    const after = await txRepo!.searchByUser(
      userB,
      'iso-b',
      { page: 1, limit: 50 },
      'IDR',
    );
    expect(after.items.some((t) => t.id === txB)).toBe(true);

    // user B's account is still scoped-listed and untouched
    const bAccounts = await prisma.account.findMany({
      where: { user_id: userB, deleted_at: null },
    });
    expect(bAccounts.some((a) => a.id === accB)).toBe(true);
    const aAccounts = await prisma.account.findMany({
      where: { user_id: userA, deleted_at: null },
    });
    expect(aAccounts.some((a) => a.id === accB)).toBe(false);
  });
});