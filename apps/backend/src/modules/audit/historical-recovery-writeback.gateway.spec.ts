import { PrismaClient } from '../../generated/prisma/client';
import { HistoricalRecoveryWriteGateway } from './historical-recovery-writeback.gateway';
import {
  computeSourceFingerprint,
  RecoveryCandidate,
  RecoveryWriteRejectedError,
} from './historical-recovery-writeback.contracts';

interface FakeTransactionRow {
  id: string;
  user_id: string;
  account_id: string;
  transaction_type: string;
  amount_cents: bigint;
  transaction_date: Date;
  deleted_at: Date | null;
}

interface FakeAccountRow {
  id: string;
  user_id: string;
  currency: string;
  opening_balance_cents: bigint;
  current_balance_cents: bigint;
}

interface FakeLedgerRow {
  recovery_id: string;
  finding_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  currency: string;
  status: string;
  before_value_cents: bigint;
  after_value_cents: bigint;
  approved_by: string | null;
  executed_by: string | null;
  rolled_back_by: string | null;
  rollback_status: string | null;
  source_fingerprint: string;
  evidence: string[];
  error_reason: string | null;
  approved_at: Date | null;
  executed_at: Date | null;
  rolled_back_at: Date | null;
}

interface FakeAuditRow {
  user_id: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
}

interface FakeStore {
  transactions: Map<string, FakeTransactionRow>;
  accounts: Map<string, FakeAccountRow>;
  ledger: Map<string, FakeLedgerRow>;
  auditLogs: FakeAuditRow[];
}

function cloneValue<T>(value: T): T {
  if (typeof value === 'bigint') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) {
    return value.map((item: unknown) => cloneValue(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = cloneValue(item);
    }
    return out as T;
  }
  return value;
}

function cloneStore(store: FakeStore): FakeStore {
  return {
    transactions: new Map(
      Array.from(store.transactions.entries()).map(([key, row]) => [
        key,
        cloneValue(row),
      ]),
    ),
    accounts: new Map(
      Array.from(store.accounts.entries()).map(([key, row]) => [
        key,
        cloneValue(row),
      ]),
    ),
    ledger: new Map(
      Array.from(store.ledger.entries()).map(([key, row]) => [
        key,
        cloneValue(row),
      ]),
    ),
    auditLogs: store.auditLogs.map((row) => cloneValue(row)),
  };
}

function aggregateAmount(
  transactions: Map<string, FakeTransactionRow>,
  where: { account_id?: string; transaction_type?: string },
): bigint {
  let total = 0n;
  for (const row of transactions.values()) {
    if (where.account_id && row.account_id !== where.account_id) continue;
    if (
      where.transaction_type &&
      row.transaction_type !== where.transaction_type
    )
      continue;
    if (row.deleted_at !== null) continue;
    total += row.amount_cents;
  }
  return total;
}

class FakePrisma {
  store: FakeStore;

  failNextAggregate = false;

  constructor(store: FakeStore) {
    this.store = store;
  }

  async $transaction<T>(
    fn: (tx: Record<string, unknown>) => Promise<T>,
  ): Promise<T> {
    const staged = cloneStore(this.store);
    const failNextAggregate = this.failNextAggregate;
    this.failNextAggregate = false;
    const tx = {
      transaction: {
        findUnique: (args: { where: { id: string } }) =>
          cloneValue(staged.transactions.get(args.where.id) ?? null),
        updateMany: (args: {
          where: Partial<FakeTransactionRow>;
          data: { amount_cents: bigint };
        }) => {
          let count = 0;
          for (const [key, row] of staged.transactions.entries()) {
            const matches =
              row.id === args.where.id &&
              (args.where.amount_cents === undefined ||
                row.amount_cents === args.where.amount_cents) &&
              (args.where.deleted_at === undefined ||
                row.deleted_at === args.where.deleted_at);
            if (!matches) continue;
            staged.transactions.set(key, {
              ...row,
              amount_cents: args.data.amount_cents,
            });
            count += 1;
          }
          return { count };
        },
        aggregate: (args: {
          where: { account_id: string };
          _sum: { amount_cents: true };
        }) => {
          if (failNextAggregate) {
            throw new Error('simulated aggregate failure');
          }
          return {
            _sum: {
              amount_cents: aggregateAmount(staged.transactions, args.where),
            },
          };
        },
      },
      account: {
        findUnique: (args: { where: { id: string } }) =>
          cloneValue(staged.accounts.get(args.where.id) ?? null),
        update: (args: {
          where: { id: string };
          data: { current_balance_cents: bigint };
        }) => {
          const row = staged.accounts.get(args.where.id);
          if (!row) throw new Error('account not found');
          const updated = {
            ...row,
            current_balance_cents: args.data.current_balance_cents,
          };
          staged.accounts.set(args.where.id, updated);
          return cloneValue(updated);
        },
      },
      historicalRecoveryLedger: {
        findUnique: (args: { where: { recovery_id: string } }) => {
          const row = staged.ledger.get(args.where.recovery_id);
          if (!row) return null;
          return {
            ...cloneValue(row),
            evidence: Array.isArray(row.evidence) ? row.evidence : [],
          };
        },
        findFirst: (args: {
          where: {
            entity_type?: string;
            entity_id?: string;
            status?: { in: string[] };
          };
        }) => {
          for (const row of staged.ledger.values()) {
            const matches =
              (args.where.entity_type === undefined ||
                row.entity_type === args.where.entity_type) &&
              (args.where.entity_id === undefined ||
                row.entity_id === args.where.entity_id) &&
              (args.where.status === undefined ||
                args.where.status.in.includes(row.status));
            if (matches) return cloneValue(row);
          }
          return null;
        },
        create: (args: { data: Record<string, unknown> }) => {
          const row = args.data as unknown as FakeLedgerRow;
          if (staged.ledger.has(row.recovery_id)) {
            const error = new Error('unique violation') as Error & {
              code: string;
            };
            error.code = 'P2002';
            throw error;
          }
          staged.ledger.set(row.recovery_id, cloneValue(row));
          return cloneValue(row);
        },
        update: (args: {
          where: { recovery_id: string };
          data: Partial<FakeLedgerRow>;
        }) => {
          const row = staged.ledger.get(args.where.recovery_id);
          if (!row) throw new Error('ledger row not found');
          const updated = { ...row, ...args.data };
          staged.ledger.set(args.where.recovery_id, updated);
          return cloneValue(updated);
        },
      },
      auditLog: {
        create: (args: { data: Record<string, unknown> }): FakeAuditRow => {
          const row: FakeAuditRow = {
            user_id: (args.data.user_id as string | null) ?? null,
            action: args.data.action as string,
            module: args.data.module as string,
            entity_type: (args.data.entity_type as string | null) ?? null,
            entity_id: (args.data.entity_id as string | null) ?? null,
            metadata: args.data.metadata,
          };
          staged.auditLogs.push(row);
          return row;
        },
      },
    };
    const result = await fn(tx);
    this.store = staged;
    return result;
  }
}

function buildCandidate(
  overrides: Partial<RecoveryCandidate> = {},
): RecoveryCandidate {
  return {
    entityType: 'transaction',
    entityId: 'tx-candidate',
    userId: 'u1',
    accountId: 'acc-a',
    currency: 'IDR',
    transactionType: 'INCOME',
    transactionDate: new Date('2026-08-11T14:08:31.606Z'),
    amountCents: 1250000n,
    ...overrides,
  };
}

function buildStore(): FakeStore {
  const date = new Date('2026-08-11T14:08:31.606Z');
  return {
    transactions: new Map([
      [
        'tx-candidate',
        {
          id: 'tx-candidate',
          user_id: 'u1',
          account_id: 'acc-a',
          transaction_type: 'INCOME',
          amount_cents: 1250000n,
          transaction_date: date,
          deleted_at: null,
        },
      ],
      [
        'tx-unrelated',
        {
          id: 'tx-unrelated',
          user_id: 'u1',
          account_id: 'acc-a',
          transaction_type: 'INCOME',
          amount_cents: 50000n,
          transaction_date: new Date('2026-08-10T00:00:00.000Z'),
          deleted_at: null,
        },
      ],
      [
        'tx-expense',
        {
          id: 'tx-expense',
          user_id: 'u1',
          account_id: 'acc-a',
          transaction_type: 'EXPENSE',
          amount_cents: 150000n,
          transaction_date: new Date('2026-08-12T00:00:00.000Z'),
          deleted_at: null,
        },
      ],
    ]),
    accounts: new Map([
      [
        'acc-a',
        {
          id: 'acc-a',
          user_id: 'u1',
          currency: 'IDR',
          opening_balance_cents: 1000000n,
          current_balance_cents: 2150000n,
        },
      ],
    ]),
    ledger: new Map(),
    auditLogs: [],
  };
}

describe('HistoricalRecoveryWriteGateway (unit)', () => {
  const candidate = buildCandidate();
  const fingerprint = computeSourceFingerprint(candidate);
  const request = {
    recoveryId: 'recovery-1',
    findingId: 'finding-1',
    actorId: 'u1',
    approvedBy: 'u1',
    currency: 'IDR',
    beforeValueCents: 1250000n,
    afterValueCents: 1200000n,
    candidate,
    evidence: ['unit-fixture', 'synthetic-evidence'],
  };

  it('rejects forbidden Prisma write operations through the guarded transaction client', async () => {
    const gateway = new HistoricalRecoveryWriteGateway(
      new FakePrisma(buildStore()) as unknown as PrismaClient,
    );

    await expect(
      gateway.transaction((tx): Promise<unknown> => {
        const client = tx as unknown as {
          transaction: { update: unknown };
        };
        return Promise.resolve(client.transaction.update);
      }),
    ).rejects.toThrow(
      /Forbidden Prisma write operation on recovery write gateway: update/,
    );

    await expect(
      gateway.transaction((tx): Promise<unknown> => {
        const client = tx as unknown as {
          transaction: { deleteMany: unknown };
        };
        return Promise.resolve(client.transaction.deleteMany);
      }),
    ).rejects.toThrow(/deleteMany/);

    await expect(
      gateway.transaction((tx): Promise<unknown> => {
        const client = tx as unknown as { $executeRaw: unknown };
        return Promise.resolve(client.$executeRaw);
      }),
    ).rejects.toThrow(/\$executeRaw/);

    await expect(
      gateway.transaction((tx): Promise<unknown> => {
        const client = tx as unknown as { user: { create: unknown } };
        return Promise.resolve(client.user.create);
      }),
    ).rejects.toThrow(/create/);
  });

  it('computes deterministic fingerprints that change with the reviewed state', () => {
    const again = buildCandidate();
    expect(computeSourceFingerprint(again)).toBe(fingerprint);

    expect(
      computeSourceFingerprint({ ...candidate, amountCents: 1200000n }),
    ).not.toBe(fingerprint);
    expect(
      computeSourceFingerprint({
        ...candidate,
        transactionDate: new Date('2026-08-12T00:00:00.000Z'),
      }),
    ).not.toBe(fingerprint);
    expect(
      computeSourceFingerprint({ ...candidate, currency: 'USD' }),
    ).not.toBe(fingerprint);
    expect(
      computeSourceFingerprint({ ...candidate, transactionType: 'EXPENSE' }),
    ).not.toBe(fingerprint);
    expect(
      computeSourceFingerprint({ ...candidate, accountId: 'acc-b' }),
    ).not.toBe(fingerprint);
  });

  it('applies an approved recovery with exact values, balance recalculation, ledger and audit entries', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);

    expect(outcome.status).toBe('APPLIED');
    expect(outcome.mutated).toBe(true);
    expect(outcome.beforeValueCents).toBe(1250000n);
    expect(outcome.afterValueCents).toBe(1200000n);
    expect(outcome.sourceFingerprint).toBe(fingerprint);
    expect(outcome.ledgerStatus).toBe('APPLIED');
    expect(outcome.newBalanceCents).toBe(2100000n);

    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1200000n,
    );
    expect(fake.store.accounts.get('acc-a')?.current_balance_cents).toBe(
      2100000n,
    );

    const ledger = fake.store.ledger.get('recovery-1');
    expect(ledger?.status).toBe('APPLIED');
    expect(ledger?.before_value_cents).toBe(1250000n);
    expect(ledger?.after_value_cents).toBe(1200000n);
    expect(ledger?.source_fingerprint).toBe(fingerprint);
    expect(ledger?.executed_by).toBe('u1');

    const audits = fake.store.auditLogs.filter(
      (row) => row.action === 'HISTORICAL_RECOVERY_EXECUTED',
    );
    expect(audits.length).toBe(1);
    expect(audits[0].entity_id).toBe('tx-candidate');
  });

  it('is idempotent: a second execution never duplicates the mutation', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const first = await gateway.applyRecovery(request);
    const second = await gateway.applyRecovery(request);

    expect(first.status).toBe('APPLIED');
    expect(second.status).toBe('ALREADY_EXECUTED');
    expect(second.mutated).toBe(false);
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1200000n,
    );
    expect(fake.store.ledger.size).toBe(1);
    expect(fake.store.accounts.get('acc-a')?.current_balance_cents).toBe(
      2100000n,
    );
  });

  it('rejects a stale candidate when the stored amount changed since approval', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.transactions.get('tx-candidate')!.amount_cents = 999999n;
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);

    expect(outcome.status).toBe('STALE');
    expect(outcome.mutated).toBe(false);
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      999999n,
    );
    expect(fake.store.ledger.size).toBe(0);
    expect(fake.store.auditLogs.length).toBe(0);
  });

  it('rejects a stale candidate when the transaction type changed', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.transactions.get('tx-candidate')!.transaction_type = 'EXPENSE';
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);
    expect(outcome.status).toBe('STALE');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('rejects a stale candidate when the transaction date changed', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.transactions.get('tx-candidate')!.transaction_date = new Date(
      '2026-09-01T00:00:00.000Z',
    );
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);
    expect(outcome.status).toBe('STALE');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('rejects a stale candidate when the account currency changed', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.accounts.get('acc-a')!.currency = 'USD';
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);
    expect(outcome.status).toBe('STALE');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('rejects a stale candidate when the record was deleted', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.transactions.get('tx-candidate')!.deleted_at = new Date(
      '2026-08-13T00:00:00.000Z',
    );
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);
    expect(outcome.status).toBe('STALE');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('rejects a second active recovery on the same record', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.ledger.set('recovery-other', {
      recovery_id: 'recovery-other',
      finding_id: 'finding-other',
      entity_type: 'transaction',
      entity_id: 'tx-candidate',
      user_id: 'u1',
      currency: 'IDR',
      status: 'APPLIED',
      before_value_cents: 1250000n,
      after_value_cents: 1240000n,
      approved_by: 'u1',
      executed_by: 'u1',
      rolled_back_by: null,
      rollback_status: null,
      source_fingerprint: fingerprint,
      evidence: [],
      error_reason: null,
      approved_at: new Date(),
      executed_at: new Date(),
      rolled_back_at: null,
    });
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);
    expect(outcome.status).toBe('REJECTED');
    expect(outcome.reason).toContain('Another recovery operation');
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1250000n,
    );
  });

  it('rejects a recovery when the target transaction does not exist', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery({
      ...request,
      candidate: { ...candidate, entityId: 'tx-missing' },
    });

    expect(outcome.status).toBe('REJECTED');
    expect(outcome.reason).toContain('does not exist');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('rolls back everything when a mid-transaction step fails', async () => {
    const fake = new FakePrisma(buildStore());
    fake.failNextAggregate = true;
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery(request);

    expect(outcome.status).toBe('FAILED');
    expect(outcome.mutated).toBe(false);
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1250000n,
    );
    expect(fake.store.accounts.get('acc-a')?.current_balance_cents).toBe(
      2150000n,
    );
    expect(fake.store.ledger.size).toBe(0);
    expect(fake.store.auditLogs.length).toBe(0);
  });

  it('rolls back to the exact original value and updates the ledger and audit trail', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    await gateway.applyRecovery(request);
    const rollback = await gateway.rollbackRecovery({
      recoveryId: 'recovery-1',
      actorId: 'u1',
    });

    expect(rollback.status).toBe('ROLLED_BACK');
    expect(rollback.mutated).toBe(true);
    expect(rollback.beforeValueCents).toBe(1200000n);
    expect(rollback.afterValueCents).toBe(1250000n);

    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1250000n,
    );
    expect(fake.store.accounts.get('acc-a')?.current_balance_cents).toBe(
      2150000n,
    );
    expect(fake.store.ledger.get('recovery-1')?.status).toBe('ROLLED_BACK');
    expect(
      fake.store.auditLogs.some(
        (row) => row.action === 'HISTORICAL_RECOVERY_ROLLED_BACK',
      ),
    ).toBe(true);
  });

  it('keeps unrelated transactions untouched through apply and rollback', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    await gateway.applyRecovery(request);
    await gateway.rollbackRecovery({
      recoveryId: 'recovery-1',
      actorId: 'u1',
    });

    expect(fake.store.transactions.get('tx-unrelated')?.amount_cents).toBe(
      50000n,
    );
    expect(fake.store.transactions.get('tx-expense')?.amount_cents).toBe(
      150000n,
    );
    expect(fake.store.transactions.size).toBe(3);
  });

  it('rolls back idempotently: a second rollback never mutates again', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    await gateway.applyRecovery(request);
    const first = await gateway.rollbackRecovery({
      recoveryId: 'recovery-1',
      actorId: 'u1',
    });
    const second = await gateway.rollbackRecovery({
      recoveryId: 'recovery-1',
      actorId: 'u1',
    });

    expect(first.status).toBe('ROLLED_BACK');
    expect(first.mutated).toBe(true);
    expect(second.status).toBe('ALREADY_ROLLED_BACK');
    expect(second.mutated).toBe(false);
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      1250000n,
    );
  });

  it('refuses to roll back when the applied amount was modified since execution', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    await gateway.applyRecovery(request);
    fake.store.transactions.get('tx-candidate')!.amount_cents = 999999n;

    const rollback = await gateway.rollbackRecovery({
      recoveryId: 'recovery-1',
      actorId: 'u1',
    });

    expect(rollback.status).toBe('STALE');
    expect(rollback.mutated).toBe(false);
    expect(fake.store.transactions.get('tx-candidate')?.amount_cents).toBe(
      999999n,
    );
  });

  it('rejects rollback of an unknown recovery operation', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const rollback = await gateway.rollbackRecovery({
      recoveryId: 'recovery-unknown',
      actorId: 'u1',
    });

    expect(rollback.status).toBe('REJECTED');
    expect(rollback.mutated).toBe(false);
  });

  it('rejects rollback of a recovery that was never applied', async () => {
    const fake = new FakePrisma(buildStore());
    fake.store.ledger.set('recovery-rejected', {
      recovery_id: 'recovery-rejected',
      finding_id: 'finding-rejected',
      entity_type: 'transaction',
      entity_id: 'tx-candidate',
      user_id: 'u1',
      currency: 'IDR',
      status: 'REJECTED',
      before_value_cents: 1250000n,
      after_value_cents: 1200000n,
      approved_by: 'u1',
      executed_by: null,
      rolled_back_by: null,
      rollback_status: null,
      source_fingerprint: fingerprint,
      evidence: [],
      error_reason: null,
      approved_at: new Date(),
      executed_at: null,
      rolled_back_at: null,
    });
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const rollback = await gateway.rollbackRecovery({
      recoveryId: 'recovery-rejected',
      actorId: 'u1',
    });

    expect(rollback.status).toBe('REJECTED');
    expect(rollback.reason).toContain('not in APPLIED state');
  });

  it('cross-account candidate never matches the target record', async () => {
    const fake = new FakePrisma(buildStore());
    const gateway = new HistoricalRecoveryWriteGateway(
      fake as unknown as PrismaClient,
    );

    const outcome = await gateway.applyRecovery({
      ...request,
      candidate: { ...candidate, accountId: 'acc-b' },
    });

    expect(outcome.status).toBe('STALE');
    expect(outcome.reason).toContain('account');
    expect(fake.store.ledger.size).toBe(0);
  });

  it('exposes a structured rejection error for forbidden access', () => {
    const gateway = new HistoricalRecoveryWriteGateway(
      new FakePrisma(buildStore()) as unknown as PrismaClient,
    );
    const error = new RecoveryWriteRejectedError('blocked');
    expect(error.name).toBe('RecoveryWriteRejectedError');
    expect(gateway).toBeDefined();
  });
});
