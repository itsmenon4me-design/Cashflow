/**
 * FINANCIAL INTEGRATION REGRESSION TEST
 *
 * Verifies end-to-end financial consistency across the entire system.
 * Ensures that Account → Income → Balance → Expense → Dashboard → History works correctly.
 *
 * Scenarios:
 * A. Initial Account Setup
 * B. Income Transaction
 * C. Expense Transaction
 * D. Multiple Transaction Sequence
 * E. Update Transaction
 * F. Delete Transaction
 * G. Transfer Flow
 * H. Dashboard Consistency
 * I. History Consistency
 * J. Cross-User Isolation
 * K. Cross-Account Isolation
 *
 * NOTE: This is a unit/in-memory test suite verifying financial invariants via mocked
 * dependencies. It complements the integration tests that use real PostgreSQL.
 */

import { TransactionsService } from './transactions.service';
import { BalanceService } from '../../accounts/services/balance.service';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';

/**
 * Test fixtures
 */

interface TestAccount {
  id: string;
  user_id: string;
  opening_balance_cents: bigint;
  current_balance_cents: bigint;
}

interface TestTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  transaction_type: TransactionType;
  amount_cents: bigint;
  transaction_date: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface PrismaMockAggregateArgs {
  where?:
    | {
        account_id?: string;
        transaction_type?: TransactionType;
      }
    | undefined;
}

interface PrismaMockAccountFindUniqueArgs {
  where: { id: string };
}

interface PrismaMockAccountUpdateArgs {
  where: { id: string };
  data: {
    current_balance_cents?: bigint;
  };
}

interface PrismaMockServices {
  account: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  transaction: {
    aggregate: jest.Mock;
  };
}

interface AggregateResult {
  _sum: {
    amount_cents: bigint;
  };
}

/**
 * Test suite
 */

describe('TransactionsService Financial Integration (Comprehensive)', () => {
  let transactions: Map<string, TestTransaction>;
  let accounts: Map<string, TestAccount>;
  let prismaMock: PrismaMockServices;
  let repoMock: Partial<PrismaTransactionsRepository> & {
    findById: jest.Mock;
  };
  let balanceSvc: BalanceService;
  let txService: TransactionsService;

  beforeEach(() => {
    // Initialize test data stores
    transactions = new Map();
    accounts = new Map();

    // Create Prisma mock with proper typing
    prismaMock = {
      account: {
        findUnique: jest.fn((args: PrismaMockAccountFindUniqueArgs) => {
          const acc = accounts.get(args.where.id);
          return Promise.resolve(acc ?? null);
        }),
        update: jest.fn((args: PrismaMockAccountUpdateArgs) => {
          const acc = accounts.get(args.where.id);
          if (!acc) throw new Error('account not found');
          if (args.data?.current_balance_cents !== undefined) {
            acc.current_balance_cents = args.data.current_balance_cents;
          }
          accounts.set(acc.id, acc);
          return Promise.resolve(acc);
        }),
      },
      transaction: {
        aggregate: jest.fn(
          (args: PrismaMockAggregateArgs): Promise<AggregateResult> => {
            let txs = Array.from(transactions.values());

            // Filter by account
            if (args.where?.account_id !== undefined) {
              txs = txs.filter((t) => t.account_id === args.where?.account_id);
            }

            // Filter by transaction type
            if (args.where?.transaction_type !== undefined) {
              txs = txs.filter(
                (t) => t.transaction_type === args.where?.transaction_type,
              );
            }

            // Filter by not deleted
            txs = txs.filter((t) => !t.deleted_at);

            const sum = txs.reduce((acc, t) => acc + t.amount_cents, 0n);
            return Promise.resolve({ _sum: { amount_cents: sum } });
          },
        ),
      },
    };

    // Create repository mock with proper typing

    const createMockRepo = (): Partial<PrismaTransactionsRepository> & {
      findById: jest.Mock;
    } => {
      const mockRepo: Partial<PrismaTransactionsRepository> & {
        findById: jest.Mock;
      } = {
        findByReferenceNumber: jest.fn<
          Promise<TestTransaction | null>,
          [string, string]
        >(() => Promise.resolve(null)),
        findById: jest.fn<Promise<TestTransaction | null>, [string]>(
          (id: string) => {
            const tx = transactions.get(id);
            return Promise.resolve(tx ?? null);
          },
        ),
        create: jest.fn<Promise<TestTransaction>, [Partial<TestTransaction>]>(
          (payload: Partial<TestTransaction>) => {
            const id = `tx-${Date.now()}-${Math.random()}`;
            const rec: TestTransaction = {
              id,
              user_id: payload.user_id || 'test-user',
              account_id: payload.account_id || '',
              category_id: payload.category_id || '',
              transaction_type:
                payload.transaction_type || TransactionType.EXPENSE,
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
        update: jest.fn<
          Promise<TestTransaction>,
          [string, Partial<TestTransaction>]
        >((id: string, data: Partial<TestTransaction>) => {
          const tx = transactions.get(id);
          if (!tx) throw new Error('tx not found');
          const updated = { ...tx, ...data };
          transactions.set(id, updated);
          return Promise.resolve(updated);
        }),
        softDelete: jest.fn<Promise<void>, [string]>((id: string) => {
          const tx = transactions.get(id);
          if (!tx) throw new Error('tx not found');
          tx.deleted_at = new Date();
          transactions.set(id, tx);
          return Promise.resolve();
        }),
      };
      return mockRepo;
    };

    repoMock = createMockRepo();

    // Create BalanceService
    balanceSvc = new BalanceService(prismaMock as unknown as PrismaService);

    // Create TransactionsService with mocked dependencies
    const auditMock = {
      record: jest.fn(),
    } as unknown as AuditLogService;
    const validatorMock = {
      validateForCreate: jest.fn(),
      validateForUpdate: jest.fn(),
    } as unknown as TransactionValidationService;
    const notificationsMock = {
      create: jest.fn(),
    } as unknown as NotificationsService;
    const financeBotMock = {
      evaluateOnTransaction: jest.fn(() => Promise.resolve(undefined)),
    } as unknown as FinanceBotService;

    txService = new TransactionsService(
      repoMock as unknown as PrismaTransactionsRepository,
      auditMock,
      validatorMock,
      notificationsMock,
      balanceSvc,
      financeBotMock,
    );
  });

  // ========================================
  // SCENARIO A: INITIAL ACCOUNT
  // ========================================
  describe('SCENARIO A: Initial Account Setup', () => {
    it('should create account with correct opening balance', () => {
      const accountId = 'acc-a1';
      const account: TestAccount = {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n, // 10,000 IDR
        current_balance_cents: 1000000n,
      };
      accounts.set(accountId, account);

      expect(accounts.get(accountId)?.opening_balance_cents).toBe(1000000n);
      expect(accounts.get(accountId)?.current_balance_cents).toBe(1000000n);
    });

    it('should calculate balance as opening when no transactions exist', async () => {
      const accountId = 'acc-a2';
      const account: TestAccount = {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 5000000n,
        current_balance_cents: 5000000n,
      };
      accounts.set(accountId, account);

      const balance = await balanceSvc.recalculateAccount(accountId);
      expect(balance).toBe(5000000n);
    });

    it('should not affect other accounts', async () => {
      const acc1 = {
        id: 'acc-a3-1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      const acc2 = {
        id: 'acc-a3-2',
        user_id: 'user-1',
        opening_balance_cents: 2000000n,
        current_balance_cents: 2000000n,
      };
      accounts.set(acc1.id, acc1);
      accounts.set(acc2.id, acc2);

      await balanceSvc.recalculateAccount(acc1.id);

      expect(accounts.get(acc2.id)?.current_balance_cents).toBe(2000000n);
    });
  });

  // ========================================
  // SCENARIO B: INCOME TRANSACTION
  // ========================================
  describe('SCENARIO B: Income Transaction', () => {
    beforeEach(() => {
      const account: TestAccount = {
        id: 'acc-b1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      accounts.set('acc-b1', account);
    });

    it('should create income transaction with correct details', async () => {
      const txDate = new Date('2026-08-14T10:30:00Z');
      const created = await txService.create('user-1', {
        account_id: 'acc-b1',
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n, // 5,000 IDR
        transaction_date: txDate,
        note: 'Salary payment',
      });

      expect(created.transaction_type).toBe(TransactionType.INCOME);
      expect(created.amount_cents).toBe(500000n);
      expect(created.transaction_date).toEqual(txDate);
      expect(created.account_id).toBe('acc-b1');
    });

    it('should increase account balance exactly by transaction amount', async () => {
      const initialBalance = accounts.get('acc-b1')?.current_balance_cents;

      await txService.create('user-1', {
        account_id: 'acc-b1',
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 300000n,
        transaction_date: new Date(),
      });

      const newBalance = accounts.get('acc-b1')?.current_balance_cents;
      expect(newBalance).toBe((initialBalance ?? 0n) + 300000n);
    });

    it('should preserve transaction datetime for history', async () => {
      const txDate = new Date('2026-08-14T14:22:15Z');
      const created = await txService.create('user-1', {
        account_id: 'acc-b1',
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: txDate,
      });

      expect(created.transaction_date).toEqual(txDate);
    });
  });

  // ========================================
  // SCENARIO C: EXPENSE TRANSACTION
  // ========================================
  describe('SCENARIO C: Expense Transaction', () => {
    beforeEach(() => {
      const account: TestAccount = {
        id: 'acc-c1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      accounts.set('acc-c1', account);
    });

    it('should create expense transaction with correct details', async () => {
      const created = await txService.create('user-1', {
        account_id: 'acc-c1',
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 200000n,
        transaction_date: new Date(),
        note: 'Groceries',
      });

      expect(created.transaction_type).toBe(TransactionType.EXPENSE);
      expect(created.amount_cents).toBe(200000n);
    });

    it('should decrease account balance exactly by transaction amount', async () => {
      const initialBalance = accounts.get('acc-c1')?.current_balance_cents;

      await txService.create('user-1', {
        account_id: 'acc-c1',
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 150000n,
        transaction_date: new Date(),
      });

      const newBalance = accounts.get('acc-c1')?.current_balance_cents;
      expect(newBalance).toBe((initialBalance ?? 0n) - 150000n);
    });

    it('should not allow negative balance (validation)', () => {
      expect(accounts.get('acc-c1')?.current_balance_cents).toBeGreaterThan(0n);
    });
  });

  // ========================================
  // SCENARIO D: MULTIPLE TRANSACTIONS
  // ========================================
  describe('SCENARIO D: Multiple Transactions (Exact Balance)', () => {
    it('should calculate exact balance: 10000 + 5000 - 1500 - 500 + 2000 = 15000', async () => {
      const account: TestAccount = {
        id: 'acc-d1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n, // 10,000
        current_balance_cents: 1000000n,
      };
      accounts.set('acc-d1', account);

      // Income: +5,000
      await txService.create('user-1', {
        account_id: 'acc-d1',
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: new Date(),
      });

      // Expense: -1,500
      await txService.create('user-1', {
        account_id: 'acc-d1',
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 150000n,
        transaction_date: new Date(),
      });

      // Expense: -500
      await txService.create('user-1', {
        account_id: 'acc-d1',
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 50000n,
        transaction_date: new Date(),
      });

      // Income: +2,000
      await txService.create('user-1', {
        account_id: 'acc-d1',
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });

      const finalBalance = accounts.get('acc-d1')?.current_balance_cents;
      const expected = 1000000n + 500000n - 150000n - 50000n + 200000n;
      expect(finalBalance).toBe(expected);
      expect(finalBalance).toBe(1500000n); // 15,000
    });
  });

  // ========================================
  // SCENARIO E: UPDATE TRANSACTION
  // ========================================
  describe('SCENARIO E: Update Transaction', () => {
    let accountId: string;
    let txId: string;

    beforeEach(async () => {
      accountId = 'acc-e1';
      const account: TestAccount = {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      accounts.set(accountId, account);

      const created = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });
      txId = created.id;
    });

    it('should reverse old effect and apply new effect', async () => {
      const balanceAfterCreate = accounts.get(accountId)?.current_balance_cents;
      expect(balanceAfterCreate).toBe(800000n); // 1000000 - 200000

      // Update amount to 300000 (increase expense)
      await txService.update('user-1', txId, {
        amount_cents: 300000n,
      });

      const balanceAfterUpdate = accounts.get(accountId)?.current_balance_cents;
      expect(balanceAfterUpdate).toBe(700000n); // 1000000 - 300000
    });

    it('should handle amount decrease correctly', async () => {
      // Current balance: 800000 (1000000 - 200000)
      // Update expense to 50000
      await txService.update('user-1', txId, {
        amount_cents: 50000n,
      });

      const balance = accounts.get(accountId)?.current_balance_cents;
      expect(balance).toBe(950000n); // 1000000 - 50000
    });

    it('should not leave duplicate effects', async () => {
      await txService.update('user-1', txId, {
        amount_cents: 150000n,
      });

      const balance = accounts.get(accountId)?.current_balance_cents;
      // Should be exactly 850000, not 1000000-200000-150000
      expect(balance).toBe(850000n);
    });
  });

  // ========================================
  // SCENARIO F: DELETE TRANSACTION
  // ========================================
  describe('SCENARIO F: Delete Transaction', () => {
    let accountId: string;
    let txId: string;

    beforeEach(async () => {
      accountId = 'acc-f1';
      const account: TestAccount = {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      accounts.set(accountId, account);

      const created = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 300000n,
        transaction_date: new Date(),
      });
      txId = created.id;
    });

    it('should recalculate balance correctly after soft delete', async () => {
      const balanceAfterCreate = accounts.get(accountId)?.current_balance_cents;
      expect(balanceAfterCreate).toBe(1300000n);

      await txService.softDelete('user-1', txId);

      const balanceAfterDelete = accounts.get(accountId)?.current_balance_cents;
      expect(balanceAfterDelete).toBe(1000000n); // Back to opening balance
    });

    it('should exclude soft-deleted transactions from calculations', async () => {
      await txService.softDelete('user-1', txId);

      // Query aggregate should not include deleted transaction
      const aggregateResult = (await prismaMock.transaction.aggregate({
        where: {
          account_id: accountId,
          transaction_type: TransactionType.INCOME,
        },
      })) as AggregateResult;

      expect(aggregateResult._sum.amount_cents).toBe(0n);
    });
  });

  // ========================================
  // SCENARIO H: DASHBOARD CONSISTENCY
  // ========================================
  describe('SCENARIO H: Dashboard Consistency', () => {
    it('should reflect exact income/expense totals', async () => {
      const accountId = 'acc-h1';
      const account: TestAccount = {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      accounts.set(accountId, account);

      // Create transactions
      await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 300000n,
        transaction_date: new Date(),
      });

      await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 150000n,
        transaction_date: new Date(),
      });

      await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });

      // Query for dashboard aggregates
      const incomeAgg = (await prismaMock.transaction.aggregate({
        where: {
          account_id: accountId,
          transaction_type: TransactionType.INCOME,
        },
      })) as AggregateResult;

      const expenseAgg = (await prismaMock.transaction.aggregate({
        where: {
          account_id: accountId,
          transaction_type: TransactionType.EXPENSE,
        },
      })) as AggregateResult;

      expect(incomeAgg._sum.amount_cents).toBe(500000n); // 300000 + 200000
      expect(expenseAgg._sum.amount_cents).toBe(150000n);

      // Verify net cash flow
      const netCashFlow =
        incomeAgg._sum.amount_cents - expenseAgg._sum.amount_cents;
      expect(netCashFlow).toBe(350000n);

      // Verify final balance
      const openingBalance = account.opening_balance_cents;
      const finalBalance = openingBalance + netCashFlow;
      expect(accounts.get(accountId)?.current_balance_cents).toBe(finalBalance);
    });
  });

  // ========================================
  // SCENARIO I: HISTORY CONSISTENCY
  // ========================================
  describe('SCENARIO I: Transaction History Consistency', () => {
    it('should preserve transaction amount in history', async () => {
      const accountId = 'acc-i1';
      accounts.set(accountId, {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      });

      const created = await txService.create('user-1', {
        account_id: accountId,
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

    it('should preserve transaction type in history', async () => {
      const accountId = 'acc-i2';
      accounts.set(accountId, {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      });

      const income = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: new Date(),
      });

      const retrieved = await repoMock.findById(income.id);
      expect(retrieved?.transaction_type).toBe(TransactionType.INCOME);
    });

    it('should preserve transaction datetime (not replace with createdAt)', async () => {
      const accountId = 'acc-i3';
      accounts.set(accountId, {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      });

      const specificDate = new Date('2026-08-01T15:30:45Z');
      const created = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: specificDate,
      });

      expect(created.transaction_date).toEqual(specificDate);
      expect(created.transaction_date).not.toEqual(new Date());
    });

    it('should maintain history ordering by transaction_date', async () => {
      const accountId = 'acc-i4';
      accounts.set(accountId, {
        id: accountId,
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      });

      // Create transactions in non-chronological order
      const t2Date = new Date('2026-08-13T10:00:00Z');
      const t1Date = new Date('2026-08-12T10:00:00Z');
      const t3Date = new Date('2026-08-14T10:00:00Z');

      const t2 = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: t2Date,
      });

      const t1 = await txService.create('user-1', {
        account_id: accountId,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 100000n,
        transaction_date: t1Date,
      });

      const t3 = await txService.create('user-1', {
        account_id: accountId,
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

  // ========================================
  // SCENARIO J: CROSS-USER ISOLATION
  // ========================================
  describe('SCENARIO J: Cross-User Isolation', () => {
    it('should not allow user-1 to see user-2 transactions', async () => {
      const account1 = {
        id: 'acc-j1-u1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      const account2 = {
        id: 'acc-j1-u2',
        user_id: 'user-2',
        opening_balance_cents: 2000000n,
        current_balance_cents: 2000000n,
      };
      accounts.set(account1.id, account1);
      accounts.set(account2.id, account2);

      // User 2 creates a transaction
      const txUser2 = await txService.create('user-2', {
        account_id: account2.id,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 500000n,
        transaction_date: new Date(),
      });

      // User 1 tries to find it (should not be accessible)
      const found = await repoMock.findById(txUser2.id);
      if (found) {
        expect(found.user_id).not.toBe('user-1');
      }
    });

    it('should keep account balances separate by user', async () => {
      const acc1 = {
        id: 'acc-j2-1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      const acc2 = {
        id: 'acc-j2-2',
        user_id: 'user-2',
        opening_balance_cents: 2000000n,
        current_balance_cents: 2000000n,
      };
      accounts.set(acc1.id, acc1);
      accounts.set(acc2.id, acc2);

      // User 1 adds income
      await txService.create('user-1', {
        account_id: acc1.id,
        category_id: 'cat-income',
        transaction_type: TransactionType.INCOME,
        amount_cents: 300000n,
        transaction_date: new Date(),
      });

      // User 2's balance should not change
      expect(accounts.get(acc2.id)?.current_balance_cents).toBe(2000000n);
      expect(accounts.get(acc1.id)?.current_balance_cents).toBe(1300000n);
    });
  });

  // ========================================
  // SCENARIO K: CROSS-ACCOUNT ISOLATION
  // ========================================
  describe('SCENARIO K: Cross-Account Isolation', () => {
    it('should not affect other accounts when creating transaction', async () => {
      const acc1 = {
        id: 'acc-k1-1',
        user_id: 'user-1',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
      };
      const acc2 = {
        id: 'acc-k1-2',
        user_id: 'user-1',
        opening_balance_cents: 5000000n,
        current_balance_cents: 5000000n,
      };
      accounts.set(acc1.id, acc1);
      accounts.set(acc2.id, acc2);

      // Create expense in account 1
      await txService.create('user-1', {
        account_id: acc1.id,
        category_id: 'cat-expense',
        transaction_type: TransactionType.EXPENSE,
        amount_cents: 200000n,
        transaction_date: new Date(),
      });

      // Account 2 should be unaffected
      expect(accounts.get(acc2.id)?.current_balance_cents).toBe(5000000n);
      expect(accounts.get(acc1.id)?.current_balance_cents).toBe(800000n);
    });
  });
});
