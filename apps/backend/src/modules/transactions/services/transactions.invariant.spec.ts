import { TransactionsService } from './transactions.service';
import { TransactionType } from '../../../generated/prisma/client';
import { PrismaTransactionsRepository } from '../repositories/prisma-transactions.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { TransactionValidationService } from './validation/transaction-validation.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { FinanceBotService } from '../../finance-bot/services/finance-bot.service';

interface MockedTransactionRecord {
  id: string;
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
}

describe('TransactionsService invariants (signed balance)', () => {
  let transactions: MockedTransactionRecord[];
  let repoMock: TransactionsRepoMocks;
  let txService: TransactionsService;

  beforeEach(() => {
    transactions = [];

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
          deleted_at: null,
        } as MockedTransactionRecord;
        transactions.push(rec);
        return Promise.resolve(rec);
      }),
      update: jest.fn((id: string, data: Record<string, unknown>) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx] = { ...transactions[idx], ...data };
        return Promise.resolve(transactions[idx]);
      }),
      softDelete: jest.fn((id: string) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx].deleted_at = new Date();
        return Promise.resolve();
      }),
    };

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

  const signedBalance = () =>
    transactions
      .filter((t) => !t.deleted_at)
      .reduce(
        (acc, t) =>
          acc +
          (t.transaction_type === TransactionType.INCOME
            ? BigInt(t.amount_cents ?? 0n)
            : -BigInt(t.amount_cents ?? 0n)),
        0n,
      );

  it('TEST 1 - INCOME increases signed balance', async () => {
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });

    expect(signedBalance()).toBe(50000n);
  });

  it('TEST 2 - EXPENSE decreases signed balance', async () => {
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 25000n,
      transaction_date: new Date(),
    });

    expect(signedBalance()).toBe(-25000n);
  });

  it('TEST 3 - MULTIPLE TRANSACTIONS aggregated correctly', async () => {
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 25000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 30000n,
      transaction_date: new Date(),
    });
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 10000n,
      transaction_date: new Date(),
    });

    expect(signedBalance()).toBe(35000n);
  });

  it('TEST 4 - DELETED TRANSACTION does not affect signed balance', async () => {
    const created = await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 50000n,
      transaction_date: new Date(),
    });
    expect(signedBalance()).toBe(50000n);

    await txService.softDelete('u1', created.id);
    expect(signedBalance()).toBe(0n);
  });

  it('TEST 5 - UPDATE transaction amount recomputes signed balance', async () => {
    const created = await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.EXPENSE,
      amount_cents: 20000n,
      transaction_date: new Date(),
    });
    expect(signedBalance()).toBe(-20000n);

    await txService.update('u1', created.id, { amount_cents: 30000n });
    expect(signedBalance()).toBe(-30000n);
  });

  it('TEST 6 - NO TRANSACTION returns zero balance', async () => {
    expect(signedBalance()).toBe(0n);
  });
});
