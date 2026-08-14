import { TransactionsService } from './transactions.service';
import { BalanceService } from '../../accounts/services/balance.service';
import { TransactionType } from '../../../generated/prisma/client';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';
import type { PrismaService } from '../../../database/prisma.service';

interface AccountRecord {
  id: string;
  opening_balance_cents: bigint;
  current_balance_cents: bigint;
}

interface MockedTransactionRecord {
  id: string;
  account_id?: string;
  transaction_type?: string;
  amount_cents?: bigint;
  deleted_at?: Date | null;
}

interface TransactionsRepoMocks {
  findByReferenceNumber: jest.Mock<Promise<unknown>, [string]>;
  findById: jest.Mock<Promise<MockedTransactionRecord | null>, [string]>;
  create: jest.Mock<
    Promise<MockedTransactionRecord>,
    [Record<string, unknown>]
  >;
  update: jest.Mock<
    Promise<MockedTransactionRecord>,
    [string, Record<string, unknown>]
  >;
  softDelete: jest.Mock<Promise<void>, [string]>;
  getAccountCurrency: jest.Mock<Promise<string>, [string]>;
}

interface TransactionsPrismaMocks {
  account: {
    findUnique: jest.Mock<Promise<AccountRecord | null>, [unknown]>;
    update: jest.Mock<Promise<AccountRecord>, [unknown]>;
  };
  transaction: {
    aggregate: jest.Mock<
      Promise<{ _sum: { amount_cents: bigint } }>,
      [unknown]
    >;
  };
}

describe('TransactionsService invariants (integration-like using in-memory prisma mock)', () => {
  let transactions: MockedTransactionRecord[];
  let accounts: Record<string, AccountRecord>;
  let prismaMock: TransactionsPrismaMocks;
  let repoMock: TransactionsRepoMocks;
  let balanceSvc: BalanceService;
  let txService: TransactionsService;

  beforeEach(() => {
    transactions = [];
    accounts = {
      a1: {
        id: 'a1',
        opening_balance_cents: 100000n,
        current_balance_cents: 100000n,
      },
      a2: {
        id: 'a2',
        opening_balance_cents: 50000n,
        current_balance_cents: 50000n,
      },
    };

    // prisma mock used by BalanceService
    prismaMock = {
      account: {
        findUnique: jest.fn((args: { where?: { id?: string } }) =>
          Promise.resolve(accounts[args.where?.id ?? ''] ?? null),
        ),
        update: jest.fn(
          (args: {
            where?: { id?: string };
            data?: { current_balance_cents?: bigint };
          }) => {
            const acc = accounts[args.where?.id ?? ''];
            if (!acc) throw new Error('account not found');
            if (args.data?.current_balance_cents !== undefined) {
              acc.current_balance_cents = args.data.current_balance_cents;
            }
            return Promise.resolve(acc);
          },
        ),
      },
      transaction: {
        aggregate: jest.fn(
          (args: {
            where?: {
              account_id?: string;
              transaction_type?: string;
            };
          }) => {
            // Sum amount_cents for matching transactions
            const txs = transactions.filter((t) => {
              if (t.deleted_at) return false;
              if (
                args.where?.account_id &&
                t.account_id !== args.where.account_id
              )
                return false;
              if (
                args.where?.transaction_type &&
                t.transaction_type !== args.where.transaction_type
              )
                return false;
              return true;
            });
            const sum = txs.reduce(
              (acc, t) => acc + BigInt(t.amount_cents as bigint),
              0n,
            );
            return Promise.resolve({ _sum: { amount_cents: sum } });
          },
        ),
      },
    };

    // repo mock used by TransactionsService
    repoMock = {
      findByReferenceNumber: jest.fn(() =>
        Promise.resolve(null),
      ) as unknown as jest.Mock<Promise<unknown>, [string]>,
      findById: jest.fn((id: string) =>
        Promise.resolve(transactions.find((t) => t.id === id) ?? null),
      ),
      create: jest.fn((payload: Record<string, unknown>) => {
        const id = `tx-${transactions.length + 1}`;
        const rec: MockedTransactionRecord = {
          id,
          ...payload,
          created_at: new Date(),
          deleted_at: null,
        } as MockedTransactionRecord;
        transactions.push(rec);
        return Promise.resolve(rec);
      }),
      update: jest.fn((id: string, data: Record<string, unknown>) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx] = {
          ...transactions[idx],
          ...data,
        };
        return Promise.resolve(transactions[idx]);
      }),
      softDelete: jest.fn((id: string) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx].deleted_at = new Date();
        return Promise.resolve();
      }),
      getAccountCurrency: jest.fn(() =>
        Promise.resolve('IDR'),
      ) as unknown as jest.Mock<Promise<string>, [string]>,
    };

    balanceSvc = new BalanceService(prismaMock as unknown as PrismaService);

    // Build a TransactionsService with mocked deps
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

  it('TEST 1 - INCOME increases account balance', async () => {
    // Opening a1 = 100000
    expect(accounts['a1'].opening_balance_cents).toBe(100000n);

    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });

    // After create, BalanceService.recalculateAccount should have updated account current_balance
    expect(accounts['a1'].current_balance_cents).toBe(150000n);
  });

  it('TEST 2 - EXPENSE decreases account balance', async () => {
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 25000n,
      transaction_date: new Date(),
    });

    expect(accounts['a1'].current_balance_cents).toBe(75000n);
  });

  it('TEST 3 - MULTIPLE TRANSACTIONS aggregated correctly', async () => {
    // sequence: income 50000, income 25000, expense 30000, expense 10000
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 25000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 30000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 10000n,
      transaction_date: new Date(),
    });

    // Opening 100000 + 50000 + 25000 -30000 -10000 = 135000
    expect(accounts['a1'].current_balance_cents).toBe(135000n);
  });

  it('TEST 4 - DELETED TRANSACTION does not affect balance', async () => {
    const created = await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });
    expect(accounts['a1'].current_balance_cents).toBe(150000n);

    await txService.softDelete('u1', created.id);
    // After delete, recalc sets back to opening 100000
    expect(accounts['a1'].current_balance_cents).toBe(100000n);
  });

  it('TEST 5 - UPDATE transaction amount recalculates correctly', async () => {
    const created = await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 20000n,
      transaction_date: new Date(),
    });
    // current should be 80000
    expect(accounts['a1'].current_balance_cents).toBe(80000n);

    await txService.update('u1', created.id, {
      amount_cents: 30000n,
    });
    // now expense is 30000 => opening 100000 - 30000 = 70000
    expect(accounts['a1'].current_balance_cents).toBe(70000n);
  });

  it('TEST 6 - NO TRANSACTION returns opening', async () => {
    // ensure account a2 has no transactions
    expect(accounts['a2'].opening_balance_cents).toBe(50000n);
    // recalc account a2 directly
    const balance = await balanceSvc.recalculateAccount('a2');
    expect(balance).toBe(50000n);
  });
});
