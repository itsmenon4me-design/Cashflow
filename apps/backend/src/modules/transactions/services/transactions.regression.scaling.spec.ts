import { TransactionsService } from './transactions.service';
import { BalanceService } from '../../accounts/services/balance.service';
import { TransactionType } from '../../../generated/prisma/client';

describe('TransactionsService scaling regression (IDR 100k)', () => {
  let transactions: any[];
  let accounts: Record<string, any>;
  let prismaMock: any;
  let repoMock: any;
  let balanceSvc: BalanceService;
  let txService: TransactionsService;

  beforeEach(async () => {
    transactions = [];
    accounts = {
      a1: { id: 'a1', opening_balance_cents: 0n, current_balance_cents: 0n },
    };

    prismaMock = {
      account: {
        findUnique: jest.fn(
          async ({ where }: any) => accounts[where.id] ?? null,
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const acc = accounts[where.id];
          if (!acc) throw new Error('account not found');
          if (data.current_balance_cents !== undefined) {
            acc.current_balance_cents = data.current_balance_cents;
          }
          return acc;
        }),
      },
      transaction: {
        aggregate: jest.fn(async ({ where }: any) => {
          const txs = transactions.filter((t) => {
            if (t.deleted_at) return false;
            if (where.account_id && t.account_id !== where.account_id)
              return false;
            if (
              where.transaction_type &&
              t.transaction_type !== where.transaction_type
            )
              return false;
            return true;
          });
          const sum = txs.reduce((acc, t) => acc + BigInt(t.amount_cents), 0n);
          return { _sum: { amount_cents: sum } };
        }),
      },
    };

    repoMock = {
      findByReferenceNumber: jest.fn(async () => null),
      findById: jest.fn(
        async (id: string) => transactions.find((t) => t.id === id) ?? null,
      ),
      create: jest.fn(async (payload: any) => {
        const id = `tx-${transactions.length + 1}`;
        const rec = {
          id,
          ...payload,
          created_at: new Date(),
          deleted_at: null,
        };
        transactions.push(rec);
        return rec;
      }),
      update: jest.fn(async (id: string, data: any) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx] = { ...transactions[idx], ...data };
        return transactions[idx];
      }),
      softDelete: jest.fn(async (id: string) => {
        const idx = transactions.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error('tx not found');
        transactions[idx].deleted_at = new Date();
        return;
      }),
      getAccountCurrency: jest.fn(async (account_id: string) => 'IDR'),
    };

    balanceSvc = new BalanceService(prismaMock);

    const auditMock = { record: jest.fn() };
    const validatorMock = {
      validateForCreate: jest.fn(),
      validateForUpdate: jest.fn(),
    };
    const notificationsMock = { create: jest.fn() };
    const financeBotMock = {
      evaluateOnTransaction: jest.fn().mockResolvedValue(undefined),
    };

    txService = new TransactionsService(
      repoMock,
      auditMock as any,
      validatorMock as any,
      notificationsMock as any,
      balanceSvc,
      financeBotMock as any,
    );
  });

  it('should store and apply exactly 100000 (Rp100.000) when provided', async () => {
    // Simulate controller conversion: frontend payload amount_cents (number) -> BigInt
    const payloadAmountNumber = 100000; // frontend minor units for Rp100.000
    const payloadAmountBigInt = BigInt(payloadAmountNumber);

    // Call service.create with BigInt amount (what the controller would pass)
    const tx = await txService.create('u1', {
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
