import { TransactionsService } from './transactions.service';
import { BalanceService } from '../../accounts/services/balance.service';
import { TransactionType } from '../../../generated/prisma/client';

describe('TransactionsService invariants (integration-like using in-memory prisma mock)', () => {
  let transactions: any[];
  let accounts: Record<string, any>;
  let prismaMock: any;
  let repoMock: any;
  let balanceSvc: BalanceService;
  let txService: TransactionsService;

  beforeEach(async () => {
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
        findUnique: jest.fn(async ({ where }: any) => {
          return accounts[where.id] ?? null;
        }),
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
          // Sum amount_cents for matching transactions
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

    // repo mock used by TransactionsService
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

    // Build a TransactionsService with mocked deps
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

  it('TEST 1 - INCOME increases account balance', async () => {
    // Opening a1 = 100000
    expect(accounts['a1'].opening_balance_cents).toBe(100000n);

    const tx = await txService.create('u1', {
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
    const tx = await txService.create('u1', {
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

    const updated = await txService.update('u1', created.id, {
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
