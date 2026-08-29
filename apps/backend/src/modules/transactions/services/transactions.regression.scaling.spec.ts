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
}

describe('TransactionsService scaling regression (IDR 100k)', () => {
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

  it('should store exactly 100000 (Rp100.000) when provided', async () => {
    const payloadAmountBigInt = BigInt(100000);

    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: payloadAmountBigInt,
      transaction_date: new Date(),
    });

    expect(transactions.length).toBe(1);
    const stored = transactions[0];
    expect(BigInt(stored.amount_cents)).toBe(100000n);
  });

  it('should fail to double-scale (i.e., not store 10000000) for same input', async () => {
    await txService.create('u1', {
      category_id: 'c1',
      transaction_type: TransactionType.INCOME,
      amount_cents: 100000n,
      transaction_date: new Date(),
    });

    const stored = transactions[0];
    expect(BigInt(stored.amount_cents)).not.toBe(10000000n);
  });
});
