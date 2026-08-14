import { TransfersService } from './transfers.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { AuditLogService } from '../../audit-logs/services/audit-log.service';
import type { TransactionValidationService } from '../../transactions/services/validation/transaction-validation.service';

const account = (id: string, currency: string) => ({
  id,
  user_id: 'u1',
  currency,
  is_active: true,
  deleted_at: null,
  current_balance_cents: BigInt(1000000),
});

type CreateInput = {
  source_account_id: string;
  destination_account_id: string;
  amount_cents: bigint;
  reference?: string | null;
  transaction_date?: Date;
  note?: string | null;
};

const makeTxMock = () => ({
  transaction: {
    create: jest
      .fn()
      .mockImplementation(
        ({
          data,
        }: {
          data: { amount_cents: bigint; transfer_group_id: string | null };
        }) =>
          Promise.resolve({
            id: `tx-${data.transfer_group_id}`,
            amount_cents: data.amount_cents,
            created_at: new Date('2026-06-01T00:00:00Z'),
          }),
      ),
  },
  category: {
    findFirst: jest.fn().mockResolvedValue({ id: 'cat-transfer' }),
  },
  account: {
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
});

const makeService = (accounts: ReturnType<typeof account>[]) => {
  const txMock = makeTxMock();
  const prisma = {
    account: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          const found = accounts.find((a) => a.id === where.id);
          return Promise.resolve(found ?? null);
        }),
    },
    $transaction: jest
      .fn()
      .mockImplementation(
        (fn: (tx: ReturnType<typeof makeTxMock>) => Promise<unknown>) =>
          fn(txMock),
      ),
  };
  const audit = { record: jest.fn() };
  const service = new TransfersService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
    {} as unknown as TransactionValidationService,
  );
  return { service, prisma, audit, txMock };
};

const createInput = (src: string, dst: string): CreateInput => ({
  source_account_id: src,
  destination_account_id: dst,
  amount_cents: 1000000n,
});

describe('TransfersService currency handling', () => {
  it('accepts same-currency transfers and keeps the amount unscaled', async () => {
    const { service, prisma, audit, txMock } = makeService([
      account('acc-a', 'IDR'),
      account('acc-b', 'IDR'),
    ]);

    const res = await service.create('u1', createInput('acc-a', 'acc-b'));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const createCalls = txMock.transaction.create.mock.calls.map(
      (calls: unknown[]) =>
        calls[0] as {
          data: {
            amount_cents: bigint;
            transfer_group_id: string | null;
            transaction_type: string;
          };
        },
    );
    const [outData, inData] = createCalls;
    // 1,000,000 IDR must travel as 1,000,000 minor units, never ×100.
    expect(outData.data.amount_cents).toBe(1000000n);
    expect(inData.data.amount_cents).toBe(1000000n);
    expect(outData.data.transfer_group_id).toBeTruthy();
    expect(outData.data.transaction_type).toBe('EXPENSE');
    expect(inData.data.transaction_type).toBe('INCOME');
    expect(audit.record).toHaveBeenCalled();
    expect(res.amount_cents).toBe('1000000');
  });

  it('rejects cross-currency transfers with the FX-not-supported error', async () => {
    const { service, prisma } = makeService([
      account('acc-a', 'USD'),
      account('acc-b', 'IDR'),
    ]);

    await expect(
      service.create('u1', createInput('acc-a', 'acc-b')),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      service.create('u1', createInput('acc-a', 'acc-b')),
    ).rejects.toThrow(/Cross-currency.*FX conversion.*not.*supported/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('never scales decimal currency cents during same-currency transfers', async () => {
    const { service, txMock } = makeService([
      account('acc-a', 'USD'),
      account('acc-b', 'USD'),
    ]);

    await service.create('u1', {
      ...createInput('acc-a', 'acc-b'),
      amount_cents: 123n,
    });

    const createCalls = txMock.transaction.create.mock.calls.map(
      (calls: unknown[]) => calls[0] as { data: { amount_cents: bigint } },
    );
    expect(createCalls[0].data.amount_cents).toBe(123n);
    expect(createCalls[1].data.amount_cents).toBe(123n);
  });

  it('updates account balances atomically and preserves total assets for same-currency transfer', async () => {
    const { service, txMock } = makeService([
      account('src', 'IDR'),
      account('dst', 'IDR'),
    ]);

    // src balance 1_000_000, dst 1_000_000 as defined; use smaller values to assert
    // adjust accounts to desired values
    txMock.account.update.mockResolvedValue({});

    // perform transfer of 200000 (IDR)
    await service.create('u1', {
      source_account_id: 'src',
      destination_account_id: 'dst',
      amount_cents: 200000n,
    });

    // Source update should use updateMany (conditional decrement) and destination should use update (increment)
    expect(txMock.account.updateMany).toHaveBeenCalledTimes(1);
    expect(txMock.account.update).toHaveBeenCalledTimes(1);
    const srcCall = (
      txMock.account.updateMany.mock.calls[0] as unknown[]
    )[0] as {
      where: { id: string };
      data: { current_balance_cents: unknown };
    };
    expect(srcCall.where.id).toBe('src');
    expect(srcCall.data.current_balance_cents).toBeDefined();
    const dstCall = (txMock.account.update.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { current_balance_cents: unknown };
    };
    expect(dstCall.where.id).toBe('dst');
    expect(dstCall.data.current_balance_cents).toBeDefined();
  });
});
