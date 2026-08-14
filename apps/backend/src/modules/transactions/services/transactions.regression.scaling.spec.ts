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
  amount_cents: bigint;
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

describe('TransactionsService scaling regression (IDR 100k)', () => {
  let transactions: MockedTransactionRecord[];
  let accounts: Record<string, AccountRecord>;
  let prismaMock: TransactionsPrismaMocks;
  let repoMock: TransactionsRepoMocks;
  let balanceSvc: BalanceService;
  let txService: TransactionsService;

  beforeEach(() => {
    transactions = [];
    accounts = {
      a1: { id: 'a1', opening_balance_cents: 0n, current_balance_cents: 0n },
    };

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
              (acc, t) => acc + BigInt(t.amount_cents),
              0n,
            );
            return Promise.resolve({ _sum: { amount_cents: sum } });
          },
        ),
      },
    };

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
          amount_cents: (payload.amount_cents as bigint) ?? 0n,
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

  it('should store and apply exactly 100000 (Rp100.000) when provided', async () => {
    // Simulate controller conversion: frontend payload amount_cents (number) -> BigInt
    const payloadAmountNumber = 100000; // frontend minor units for Rp100.000
    const payloadAmountBigInt = BigInt(payloadAmountNumber);

    // Call service.create with BigInt amount (what the controller would pass)
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: payloadAmountBigInt,
      transaction_date: new Date(),
    });

    // Repo.create should have received the payload with amount_cents as BigInt-ish (stringifiable)
    expect(transactions.length).toBe(1);
    const stored = transactions[0];
    // stored.amount_cents should equal the numeric minor-unit value
    expect(BigInt(stored.amount_cents)).toBe(100000n);

    // Balance should be opening 0 + income 100000 = 100000
    expect(accounts['a1'].current_balance_cents).toBe(100000n);
  });

  it('should fail to double-scale (i.e., not store 10000000) for same input', async () => {
    // Another create to ensure no accidental *100 multiplication occurs
    await txService.create('u1', {
      account_id: 'a1',
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 100000n,
      transaction_date: new Date(),
    });

    const stored = transactions[0];
    // assert that stored is not 10000000
    expect(BigInt(stored.amount_cents)).not.toBe(10000000n);
  });
});
