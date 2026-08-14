import { randomUUID } from 'crypto';
import { TransactionType } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { HistoricalDataRecoveryService } from './historical-data-recovery.service';
import { HistoricalRecoveryWriteGateway } from './historical-recovery-writeback.gateway';
import {
  computeSourceFingerprint,
  RecoveryCandidate,
} from './historical-recovery-writeback.contracts';

jest.setTimeout(120000);

const DB_URL = process.env.DATABASE_URL || '';

const isStagingOnly =
  DB_URL.includes('localhost:5433') &&
  DB_URL.includes('cashflow') &&
  !DB_URL.includes('vercel') &&
  !DB_URL.includes('prod') &&
  !DB_URL.includes('railway') &&
  !DB_URL.includes('render') &&
  !DB_URL.includes('neon') &&
  !DB_URL.includes('supabase');

describe('Historical recovery write-back integration (requires real Postgres staging DB)', () => {
  let prisma: PrismaService;
  let gateway: HistoricalRecoveryWriteGateway;
  let service: HistoricalDataRecoveryService;
  let userId: string;
  let categoryId: string;
  const sequence = Date.now();

  beforeAll(async () => {
    if (!isStagingOnly) {
      return;
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `recovery+${sequence}@local`,
        username: `recovery_${sequence}`,
        full_name: 'Recovery Integration Test',
        password_hash: 'x',
        status: 'active',
      },
    });
    userId = user.id;
    const category = await prisma.category.create({
      data: { user_id: userId, name: 'Recovery Test', type: 'TRANSFER' },
    });
    categoryId = category.id;
    gateway = new HistoricalRecoveryWriteGateway(prisma);
    service = new HistoricalDataRecoveryService(true, gateway);
  });

  afterAll(async () => {
    if (!isStagingOnly || !prisma) {
      return;
    }
    try {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
      await prisma.category.deleteMany({ where: { user_id: userId } });
      await prisma.user.delete({ where: { id: userId } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  async function createAccount(
    openingCents: bigint,
    name: string,
    currency = 'IDR',
  ): Promise<string> {
    const account = await prisma.account.create({
      data: {
        user_id: userId,
        name: `${name}-${sequence}`,
        account_type: 'CHECKING',
        currency,
        opening_balance_cents: openingCents,
        current_balance_cents: openingCents,
      },
    });
    return account.id;
  }

  async function createTransaction(
    accountId: string,
    type: TransactionType,
    amountCents: bigint,
    date: Date,
    transferGroupId?: string,
  ): Promise<{ id: string }> {
    return prisma.transaction.create({
      data: {
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        transaction_type: type,
        amount_cents: amountCents,
        transaction_date: date,
        ...(transferGroupId
          ? {
              transfer_group_id: transferGroupId,
              transfer_reference: 'recovery-transfer',
            }
          : {}),
      },
      select: { id: true },
    });
  }

  async function syncAccountBalance(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new Error('account missing for balance sync');
    }
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
        },
        _sum: { amount_cents: true },
      }),
      prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
        },
        _sum: { amount_cents: true },
      }),
    ]);
    const expected =
      account.opening_balance_cents +
      (income._sum.amount_cents ?? 0n) -
      (expense._sum.amount_cents ?? 0n);
    await prisma.account.update({
      where: { id: accountId },
      data: { current_balance_cents: expected },
    });
  }

  async function assertBalanceInvariant(accountId: string): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new Error('account missing for invariant check');
    }
    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.INCOME,
        },
        _sum: { amount_cents: true },
      }),
      prisma.transaction.aggregate({
        where: {
          account_id: accountId,
          deleted_at: null,
          transaction_type: TransactionType.EXPENSE,
        },
        _sum: { amount_cents: true },
      }),
    ]);
    const expected =
      account.opening_balance_cents +
      (income._sum.amount_cents ?? 0n) -
      (expense._sum.amount_cents ?? 0n);
    expect(account.current_balance_cents).toBe(expected);
  }

  function buildApprovedPlan(
    txId: string,
    currentValue: string,
    approvedValue: string,
    extraFinding: Record<string, unknown> = {},
  ): { recoveryId: string; plan: ReturnType<typeof service.buildDryRun> } {
    const plan = service.buildDryRun({
      finding: {
        finding_id: `finding-${sequence}-${txId}`,
        entity_type: 'transaction',
        entity_id: txId,
        user_id: userId,
        currency: 'IDR',
        severity: 'HIGH',
        status: 'SUSPICIOUS',
        confidence: 0.95,
        reason:
          'Reviewed amount differs from the corrected figure; synthetic integration fixture only.',
        evidence: ['synthetic-fixture', 'integration-only'],
        recommended_action: 'Apply corrected value.',
        current_value: currentValue,
        proposed_value: approvedValue,
        requires_manual_approval: true,
        ...extraFinding,
      } as never,
      actorId: userId,
      currentValue,
      currentCurrency: 'IDR',
      approvedValue,
      currentRecordOwnerId: userId,
    });
    service.approveRecovery(
      plan.recoveryId,
      userId,
      approvedValue,
      currentValue,
    );
    return { recoveryId: plan.recoveryId, plan };
  }

  function buildCandidate(
    txId: string,
    values: {
      amountCents: bigint;
      date?: Date;
      accountId?: string;
      currency?: string;
      transactionType?: string;
      userId?: string;
    },
  ): RecoveryCandidate {
    return {
      entityType: 'transaction',
      entityId: txId,
      userId: values.userId ?? userId,
      accountId: values.accountId ?? 'override-in-call',
      currency: values.currency ?? 'IDR',
      transactionType: values.transactionType ?? 'INCOME',
      transactionDate: values.date ?? new Date('2026-08-11T14:08:31.606Z'),
      amountCents: values.amountCents,
    };
  }

  it('skips or targets staging only; never a production URL', () => {
    expect(isStagingOnly || !DB_URL).toBe(true);
    if (DB_URL) {
      expect(DB_URL.startsWith('postgresql://')).toBe(true);
      expect(DB_URL).not.toContain('vercel');
      expect(DB_URL).not.toContain('railway');
      expect(DB_URL).not.toContain('render');
      expect(DB_URL).not.toContain('neon');
      expect(DB_URL).not.toContain('supabase');
    }
  });

  it('applies an approved recovery with exact values, balance recalc, ledger and audit entries', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'apply-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );
    await createTransaction(
      accountId,
      TransactionType.INCOME,
      50000n,
      new Date('2026-08-10T00:00:00.000Z'),
    );
    await createTransaction(
      accountId,
      TransactionType.EXPENSE,
      150000n,
      new Date('2026-08-12T00:00:00.000Z'),
    );
    await syncAccountBalance(accountId);
    await assertBalanceInvariant(accountId);

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };
      const result = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );

      expect(result.status).toBe('EXECUTED');
      expect(result.mutated).toBe(true);
      expect(result.beforeValue).toBe('1250000');
      expect(result.afterValue).toBe('1200000');

      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1200000n);
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });
      expect(account?.current_balance_cents).toBe(2100000n);
      await assertBalanceInvariant(accountId);

      const ledger = await prisma.historicalRecoveryLedger.findUnique({
        where: { recovery_id: recoveryId },
      });
      expect(ledger?.status).toBe('APPLIED');
      expect(ledger?.before_value_cents).toBe(1250000n);
      expect(ledger?.after_value_cents).toBe(1200000n);
      expect(ledger?.executed_by).toBe(userId);
      expect(ledger?.source_fingerprint).toBe(
        computeSourceFingerprint(candidate),
      );

      const audit = await prisma.auditLog.findFirst({
        where: {
          entity_id: tx.id,
          action: 'HISTORICAL_RECOVERY_EXECUTED',
        },
      });
      expect(audit).not.toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('is idempotent: a second execution never duplicates the mutation', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'idem-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };
      const first = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );
      const second = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );

      expect(first.mutated).toBe(true);
      expect(second.status).toBe('EXECUTED');
      expect(second.mutated).toBe(false);
      expect(second.idempotencyStatus).toBe('ALREADY_EXECUTED');

      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1200000n);
      const count = await prisma.historicalRecoveryLedger.count({
        where: { recovery_id: recoveryId },
      });
      expect(count).toBe(1);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('allows only one concurrent execution to commit; the other reports already executed', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'conc-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };
      const [a, b] = await Promise.all([
        service.executeRecoveryPersistent(recoveryId, userId, { candidate }),
        service.executeRecoveryPersistent(recoveryId, userId, { candidate }),
      ]);

      const mutated = [a, b].filter((r) => r.mutated).length;
      expect(mutated).toBe(1);
      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1200000n);
      const count = await prisma.historicalRecoveryLedger.count({
        where: { recovery_id: recoveryId },
      });
      expect(count).toBe(1);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('rejects stale candidates: amount, type, date, currency, deleted and cross-account', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'stale-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );

    await syncAccountBalance(accountId);

    const baseCandidate = {
      ...buildCandidate(tx.id, { amountCents: 1250000n }),
      accountId,
    };

    try {
      const staleByAmount = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = { ...baseCandidate };
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { amount_cents: 999999n },
      });
      const amountResult = await service.executeRecoveryPersistent(
        staleByAmount.recoveryId,
        userId,
        { candidate },
      );
      expect(amountResult.status).toBe('STALE');
      expect(amountResult.mutated).toBe(false);

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { amount_cents: 1250000n },
      });
      const staleByType = buildApprovedPlan(tx.id, '1250000', '1200000');
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { transaction_type: TransactionType.EXPENSE },
      });
      const typeResult = await service.executeRecoveryPersistent(
        staleByType.recoveryId,
        userId,
        { candidate: { ...candidate, transactionType: 'INCOME' } },
      );
      expect(typeResult.status).toBe('STALE');
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { transaction_type: TransactionType.INCOME },
      });

      const staleByDate = buildApprovedPlan(tx.id, '1250000', '1200000');
      const dateResult = await service.executeRecoveryPersistent(
        staleByDate.recoveryId,
        userId,
        {
          candidate: {
            ...candidate,
            transactionDate: new Date('2026-09-01T00:00:00.000Z'),
          },
        },
      );
      expect(dateResult.status).toBe('STALE');

      const staleByCurrency = buildApprovedPlan(tx.id, '1250000', '1200000');
      await prisma.account.update({
        where: { id: accountId },
        data: { currency: 'USD' },
      });
      const currencyResult = await service.executeRecoveryPersistent(
        staleByCurrency.recoveryId,
        userId,
        { candidate },
      );
      expect(currencyResult.status).toBe('STALE');
      await prisma.account.update({
        where: { id: accountId },
        data: { currency: 'IDR' },
      });

      const staleByDeleted = buildApprovedPlan(tx.id, '1250000', '1200000');
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { deleted_at: new Date() },
      });
      const deletedResult = await service.executeRecoveryPersistent(
        staleByDeleted.recoveryId,
        userId,
        { candidate },
      );
      expect(deletedResult.status).toBe('STALE');
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { deleted_at: null },
      });

      const staleByAccount = buildApprovedPlan(tx.id, '1250000', '1200000');
      const accountResult = await service.executeRecoveryPersistent(
        staleByAccount.recoveryId,
        userId,
        {
          candidate: {
            ...candidate,
            accountId: '00000000-0000-0000-0000-000000000000',
          },
        },
      );
      expect(accountResult.status).toBe('STALE');
      expect(accountResult.reason).toContain('account');

      const ledgerCount = await prisma.historicalRecoveryLedger.count({
        where: { user_id: userId },
      });
      expect(ledgerCount).toBe(0);
      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1250000n);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('rejects recovery before approval, without evidence, and with ×100 auto-corrections', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'gate-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );

    try {
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };

      const unapproved = service.buildDryRun({
        finding: {
          finding_id: `finding-${sequence}-unapproved`,
          entity_type: 'transaction',
          entity_id: tx.id,
          user_id: userId,
          currency: 'IDR',
          severity: 'HIGH',
          status: 'SUSPICIOUS',
          confidence: 0.95,
          reason: 'synthetic gate test',
          evidence: ['synthetic-fixture'],
          recommended_action: 'Apply corrected value.',
          current_value: '1250000',
          proposed_value: '1200000',
          requires_manual_approval: true,
        } as never,
        actorId: userId,
        currentValue: '1250000',
        currentCurrency: 'IDR',
        approvedValue: '1200000',
        currentRecordOwnerId: userId,
      });
      const notApproved = await service.executeRecoveryPersistent(
        unapproved.recoveryId,
        userId,
        { candidate },
      );
      expect(notApproved.status).toBe('REJECTED');
      expect(notApproved.reason).toContain('explicit approval');

      const noEvidence = buildApprovedPlan(tx.id, '1250000', '1200000', {
        evidence: [],
      });
      const missingEvidence = await service.executeRecoveryPersistent(
        noEvidence.recoveryId,
        userId,
        { candidate },
      );
      expect(missingEvidence.status).toBe('REJECTED');
      expect(missingEvidence.reason).toContain('preserved evidence');

      const timesHundred = service.buildDryRun({
        finding: {
          finding_id: `finding-${sequence}-x100`,
          entity_type: 'transaction',
          entity_id: tx.id,
          user_id: userId,
          currency: 'IDR',
          severity: 'HIGH',
          status: 'SUSPICIOUS',
          confidence: 0.95,
          reason: 'synthetic x100 gate test',
          evidence: ['synthetic-fixture'],
          recommended_action: 'Apply corrected value.',
          current_value: '1250000',
          proposed_value: '125000000',
          requires_manual_approval: true,
        } as never,
        actorId: userId,
        currentValue: '1250000',
        currentCurrency: 'IDR',
        approvedValue: '125000000',
        currentRecordOwnerId: userId,
      });
      expect(() =>
        service.approveRecovery(
          timesHundred.recoveryId,
          userId,
          '125000000',
          '1250000',
        ),
      ).toThrow(/×100/);

      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1250000n);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('rejects execution by a different actor and keeps the record untouched', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'actor-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );
    await syncAccountBalance(accountId);

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };

      const result = await service.executeRecoveryPersistent(
        recoveryId,
        'other-user',
        {
          candidate,
        },
      );

      expect(result.status).toBe('REJECTED');
      expect(result.reason).toContain('Unauthorized');
      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1250000n);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('rolls back to the exact original value and remains idempotent', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'roll-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );
    await createTransaction(
      accountId,
      TransactionType.INCOME,
      50000n,
      new Date('2026-08-10T00:00:00.000Z'),
    );
    await createTransaction(
      accountId,
      TransactionType.EXPENSE,
      150000n,
      new Date('2026-08-12T00:00:00.000Z'),
    );
    await syncAccountBalance(accountId);
    await assertBalanceInvariant(accountId);

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };
      const applied = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );
      expect(applied.mutated).toBe(true);

      const rolled = await service.rollbackRecoveryPersistent(
        recoveryId,
        userId,
      );
      expect(rolled.status).toBe('ROLLED_BACK');
      expect(rolled.mutated).toBe(true);
      expect(rolled.beforeValue).toBe('1200000');
      expect(rolled.afterValue).toBe('1250000');

      const secondRollback = service.rollbackRecoveryPersistent(
        recoveryId,
        userId,
      );
      await expect(secondRollback).rejects.toThrow(/already been rolled back/);

      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.amount_cents).toBe(1250000n);
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });
      expect(account?.current_balance_cents).toBe(2150000n);
      await assertBalanceInvariant(accountId);

      const ledger = await prisma.historicalRecoveryLedger.findUnique({
        where: { recovery_id: recoveryId },
      });
      expect(ledger?.status).toBe('ROLLED_BACK');
      expect(ledger?.rollback_status).toBe('ROLLED_BACK');
      expect(ledger?.rolled_back_by).toBe(userId);

      const rollbackAudit = await prisma.auditLog.findFirst({
        where: {
          entity_id: tx.id,
          action: 'HISTORICAL_RECOVERY_ROLLED_BACK',
        },
      });
      expect(rollbackAudit).not.toBeNull();

      const unrelated = await prisma.transaction.findMany({
        where: { user_id: userId },
        select: { amount_cents: true },
      });
      const amounts = unrelated
        .map((r) => r.amount_cents)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(amounts).toEqual([50000n, 150000n, 1250000n]);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('preserves transaction date and INCOME classification through apply and rollback', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(1000000n, 'preserve-a');
    const originalDate = new Date('2026-08-11T14:08:31.606Z');
    const tx = await createTransaction(
      accountId,
      TransactionType.INCOME,
      1250000n,
      originalDate,
    );

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '1250000', '1200000');
      const candidate = {
        ...buildCandidate(tx.id, { amountCents: 1250000n }),
        accountId,
      };
      await service.executeRecoveryPersistent(recoveryId, userId, {
        candidate,
      });
      await service.rollbackRecoveryPersistent(recoveryId, userId);

      const row = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(row?.transaction_date.getTime()).toBe(originalDate.getTime());
      expect(row?.transaction_type).toBe(TransactionType.INCOME);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('handles EXPENSE recoveries with the same invariant guarantees', async () => {
    if (!isStagingOnly) return;
    const accountId = await createAccount(500000n, 'expense-a');
    const tx = await createTransaction(
      accountId,
      TransactionType.EXPENSE,
      300000n,
      new Date('2026-08-11T14:08:31.606Z'),
    );
    await syncAccountBalance(accountId);
    await assertBalanceInvariant(accountId);

    try {
      const { recoveryId } = buildApprovedPlan(tx.id, '300000', '250000');
      const candidate = {
        ...buildCandidate(tx.id, {
          amountCents: 300000n,
          transactionType: 'EXPENSE',
        }),
        accountId,
      };
      const applied = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );
      expect(applied.status).toBe('EXECUTED');
      expect(applied.mutated).toBe(true);
      const afterApply = await prisma.transaction.findUnique({
        where: { id: tx.id },
      });
      expect(afterApply?.amount_cents).toBe(250000n);
      const accountAfterApply = await prisma.account.findUnique({
        where: { id: accountId },
      });
      expect(accountAfterApply?.current_balance_cents).toBe(250000n);
      await assertBalanceInvariant(accountId);

      const rolled = await service.rollbackRecoveryPersistent(
        recoveryId,
        userId,
      );
      expect(rolled.mutated).toBe(true);
      const afterRollback = await prisma.transaction.findUnique({
        where: { id: tx.id },
      });
      expect(afterRollback?.amount_cents).toBe(300000n);
      const accountAfterRollback = await prisma.account.findUnique({
        where: { id: accountId },
      });
      expect(accountAfterRollback?.current_balance_cents).toBe(200000n);
      await assertBalanceInvariant(accountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });

  it('never mutates the counterpart leg of a transfer recovery', async () => {
    if (!isStagingOnly) return;
    const groupId = randomUUID();
    const srcAccountId = await createAccount(500000n, 'transfer-src');
    const dstAccountId = await createAccount(0n, 'transfer-dst');
    const srcLeg = await createTransaction(
      srcAccountId,
      TransactionType.EXPENSE,
      200000n,
      new Date('2026-08-11T14:08:31.606Z'),
      groupId,
    );
    const dstLeg = await createTransaction(
      dstAccountId,
      TransactionType.INCOME,
      200000n,
      new Date('2026-08-11T14:08:31.606Z'),
      groupId,
    );
    await syncAccountBalance(srcAccountId);
    await syncAccountBalance(dstAccountId);

    try {
      const { recoveryId } = buildApprovedPlan(srcLeg.id, '200000', '150000');
      const candidate = {
        ...buildCandidate(srcLeg.id, {
          amountCents: 200000n,
          transactionType: 'EXPENSE',
        }),
        accountId: srcAccountId,
      };
      const applied = await service.executeRecoveryPersistent(
        recoveryId,
        userId,
        {
          candidate,
        },
      );
      expect(applied.status).toBe('EXECUTED');

      const src = await prisma.transaction.findUnique({
        where: { id: srcLeg.id },
      });
      const dst = await prisma.transaction.findUnique({
        where: { id: dstLeg.id },
      });
      expect(src?.amount_cents).toBe(150000n);
      expect(dst?.amount_cents).toBe(200000n);
      const legs = await prisma.transaction.count({
        where: { transfer_group_id: groupId },
      });
      expect(legs).toBe(2);
      await assertBalanceInvariant(srcAccountId);
      await assertBalanceInvariant(dstAccountId);

      const rolled = await service.rollbackRecoveryPersistent(
        recoveryId,
        userId,
      );
      expect(rolled.mutated).toBe(true);
      const srcAfterRollback = await prisma.transaction.findUnique({
        where: { id: srcLeg.id },
      });
      expect(srcAfterRollback?.amount_cents).toBe(200000n);
      await assertBalanceInvariant(srcAccountId);
      await assertBalanceInvariant(dstAccountId);
    } finally {
      await prisma.auditLog.deleteMany({ where: { user_id: userId } });
      await prisma.historicalRecoveryLedger.deleteMany({
        where: { user_id: userId },
      });
      await prisma.transaction.deleteMany({ where: { user_id: userId } });
      await prisma.account.deleteMany({ where: { user_id: userId } });
    }
  });
});
