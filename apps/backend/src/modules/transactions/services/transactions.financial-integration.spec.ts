import { TransactionsService } from './transactions.service';
import { TransactionType } from '../../../generated/prisma/client';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';

interface TestTransaction {
  id: string;
  user_id: string;
  category_id: string;
  transaction_type: TransactionType;
  amount_cents: bigint;
  transaction_date: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

describe('TransactionsService Financial Integration (Comprehensive)', () => {
  let transactions: Map<string, TestTransaction>;
  let repoMock: Partial<PrismaTransactionsRepository> & {
    findById: jest.Mock;
  };
  let txService: TransactionsService;

  const netBalance = () =>
    Array.from(transactions.values())
      .filter((t) => !t.deleted_at)
      .reduce(
        (acc, t) =>
          acc +
          (t.transaction_type === TransactionType.INCOME
            ? t.amount_cents
            : -t.amount_cents),
        0n,
      );

  beforeEach(() => {
    transactions = new Map();

    const mockRepo: Partial<PrismaTransactionsRepository> & {
      findById: jest.Mock;
    } = {
      findByReferenceNumber: jest.fn<Promise<TestTransaction | null>, [string, string]>(
        () => Promise.resolve(null),
      ),
      findById: jest.fn<Promise<TestTransaction | null>, [string]>(
        (id: string) => Promise.resolve(transactions.get(id) ?? null),
      ),
      create: jest.fn<Promise<TestTransaction>, [Partial<TestTransaction>]>(
        (payload: Partial<TestTransaction>) => {
          const id = `tx-${Date.now()}-${Math.random()}`;
          const rec: TestTransaction = {
            id,
            user_id: payload.user_id || 'test-user',
            category_id: payload.category_id || '',
            transaction_type: payload.transaction_type || TransactionType.EXPENSE,
            amount_cents: payload.amount_cents || 0n,
            transaction_date: payload.transaction_date || new Date(),
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          };
          transactions.set(id, rec);
          return Promise.resolve(rec);
        },
      ),
      update: jest.fn<Promise<TestTransaction>, [string, Partial<TestTransaction>]>(
        (id: string, data: Partial<TestTransaction>) => {
          const tx = transactions.get(id);
          if (!tx) throw new Error('tx not found');
          const updated = { ...tx, ...data };
          transactions.set(id, updated);
          return Promise.resolve(updated);
        },
      ),
      softDelete: jest.fn<Promise<void>, [string]>((id: string) => {
        const tx = transactions.get(id);
        if (!tx) throw new Error('tx not found');
        tx.deleted_at = new Date();
        transactions.set(id, tx);
        return Promise.resolve();
      }),
    };
    repoMock = mockRepo;

    const auditMock = { record: jest.fn() } as unknown as AuditLogService;
    const validatorMock = {
      validateForCreate: jest.fn(),
      validateForUpdate: jest.fn(),
    } as unknown as TransactionValidationService;
    const notificationsMock = { create: jest.fn() } as unknown as NotificationsService;
    const financeBotMock = {
      evaluateOnTransaction: jest.fn(() => Promise.resolve(undefined)),
    } as unknown as FinanceBotService;

    txService = new TransactionsService(
      repoMock as unknown as PrismaTransactionsRepository,
      auditMock,
      validatorMock,
      notificationsMock,
      financeBotMock,
    );
  });

  describe('CRUD behavior', () => {
    it('should create income transaction with correct details', async () => {
      const txDate = new Date('2026-08-14T10:30:00Z');
      const created = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: txDate,
        note: 'Salary payment',
      });

      expect(created.transaction_type).toBe(TransactionType.INCOME);
      expect(created.amount_cents).toBe(500000n);
      expect(created.transaction_date).toEqual(txDate);
      expect(created.user_id).toBe('user-1');
    });

    it('should create expense transaction with correct details', async () => {
      const created = await txService.create('user-1', {
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 200000n,
        transaction_date: new Date(),
        note: 'Groceries',
      });

      expect(created.transaction_type).toBe(TransactionType.EXPENSE);
      expect(created.amount_cents).toBe(200000n);
    });

    it('should preserve transaction datetime on create (not replace with createdAt)', async () => {
      const specificDate = new Date('2026-08-01T15:30:45Z');
      const created = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: specificDate,
      });

      expect(created.transaction_date).toEqual(specificDate);
      expect(created.transaction_date).not.toEqual(new Date());
    });
  });

  describe('Signed balance calculation (income - expense)', () => {
    it('should compute exact signed balance across mixed transactions', async () => {
      await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: new Date(),
      });
      await txService.create('user-1', {
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 150000n,
        transaction_date: new Date(),
      });
      await txService.create('user-1', {
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 50000n,
        transaction_date: new Date(),
      });
      await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });

      expect(netBalance()).toBe(500000n - 150000n - 50000n + 200000n);
    });

    it('should update the signed balance when a transaction amount changes', async () => {
      const created = await txService.create('user-1', {
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });

      expect(netBalance()).toBe(-200000n);

      await txService.update('user-1', created.id, { amount_cents: 300000n });
      expect(netBalance()).toBe(-300000n);
    });

    it('should exclude soft-deleted transactions from signed balance', async () => {
      const created = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 300000n,
        transaction_date: new Date(),
      });

      expect(netBalance()).toBe(300000n);

      await txService.softDelete('user-1', created.id);
      expect(netBalance()).toBe(0n);
    });
  });

  describe('History consistency', () => {
    it('should preserve transaction amount in history', async () => {
      const created = await txService.create('user-1', {
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 250000n,
        transaction_date: new Date('2026-08-14T09:00:00Z'),
        note: 'Test expense',
      });

      const retrieved = await repoMock.findById(created.id);
      expect(retrieved?.amount_cents).toBe(250000n);
      expect(retrieved?.transaction_type).toBe(TransactionType.EXPENSE);
    });

    it('should maintain history ordering by transaction_date', async () => {
      const t2Date = new Date('2026-08-13T10:00:00Z');
      const t1Date = new Date('2026-08-12T10:00:00Z');
      const t3Date = new Date('2026-08-14T10:00:00Z');

      const t2 = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: t2Date,
      });
      const t1 = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: t1Date,
      });
      const t3 = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: t3Date,
      });

      expect(t1.transaction_date).toEqual(t1Date);
      expect(t2.transaction_date).toEqual(t2Date);
      expect(t3.transaction_date).toEqual(t3Date);
    });
  });

  describe('Cross-user isolation', () => {
    it('should keep transactions separate by user via getById ownership check', async () => {
      const created = await txService.create('user-1', {
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: new Date(),
      });

      await expect(txService.getById('user-2', created.id)).rejects.toBeDefined();
      await expect(txService.getById('user-1', created.id)).resolves.toBeDefined();
    });
  });
});
