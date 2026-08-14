import { TransfersService } from './transfers.service';
import type { PrismaService } from '../../../database/prisma.service';
import type { AuditLogService } from '../../audit-logs/services/audit-log.service';
import type { TransactionValidationService } from '../../transactions/services/validation/transaction-validation.service';

interface ConcurrencyAccountState {
  id: string;
  user_id: string;
  current_balance_cents: bigint;
  deleted_at: null | Date;
  is_active: boolean;
  currency: string;
}

type AccountStateMap = Record<string, ConcurrencyAccountState>;

interface ConcurrencyTx {
  transaction: { create: jest.Mock };
  category: { findFirst: jest.Mock };
  account: { updateMany: jest.Mock; update: jest.Mock };
  _rollback: () => void;
}

interface ConcurrencyPrismaMocks {
  account: { findUnique: jest.Mock };
  $transaction: jest.Mock;
  transaction: { create: jest.Mock; findMany: jest.Mock };
}

// Concurrency unit test: simulate two concurrent transfers from same source account
// and assert final balance equals initial - sum(amounts). This is a test-first check
// for lost-update race windows. Uses mocked Prisma only (no DB). This test expects
// the correct behavior; if production code has a race, the test will fail and must
// be reported before any production changes.

describe('TransfersService - concurrency (mocked) race detection', () => {
  it('applies two concurrent transfers and preserves total deduction', async () => {
    const initialSrcBal = BigInt(100000);
    const initialDstBal = BigInt(50000);

    // Shared in-memory account state to simulate DB-side atomic conditional updates
    const accountsState: AccountStateMap = {
      src: {
        id: 'src',
        user_id: 'u1',
        current_balance_cents: initialSrcBal,
        deleted_at: null,
        is_active: true,
        currency: 'IDR',
      },
      dst: {
        id: 'dst',
        user_id: 'u1',
        current_balance_cents: initialDstBal,
        deleted_at: null,
        is_active: true,
        currency: 'IDR',
      },
    };

    // Mock prisma to operate on the shared accountsState inside each transactional callback
    const prismaMock: ConcurrencyPrismaMocks = {
      account: {
        // findUnique called before $transaction in TransfersService; return a snapshot of the account
        findUnique: jest.fn((args: { where: { id: string } }) => {
          const a = accountsState[args.where.id];
          return Promise.resolve(a ? { ...a } : null);
        }),
      },
      // $transaction executes callback with a tx that manipulates the shared accountsState atomically
      $transaction: jest.fn((cb: (tx: ConcurrencyTx) => Promise<unknown>) => {
        // per-transaction change log to support rollback without undoing other committed txs
        const changes: { id: string; before: bigint; after: bigint }[] = [];
        const recordChange = (id: string, before: bigint, after: bigint) => {
          changes.push({ id, before, after });
        };

        const tx: ConcurrencyTx = {
          transaction: {
            create: jest.fn((args: { data: Record<string, unknown> }) => {
              return Promise.resolve({
                id: cryptoId(),
                ...args.data,
                created_at: new Date(),
              });
            }),
          },
          category: { findFirst: jest.fn(() => Promise.resolve(null)) },
          account: {
            // updateMany simulates conditional atomic decrement: if balance >= amount then decrement and return count:1
            updateMany: jest.fn(
              (args: {
                where: {
                  id: string;
                  current_balance_cents?: { gte?: bigint };
                };
                data: { current_balance_cents?: { decrement?: bigint } };
              }) => {
                const id = args.where.id;
                const gte = args.where.current_balance_cents?.gte;
                const dec = args.data.current_balance_cents?.decrement;
                // ensure account exists
                const acc = accountsState[id];
                if (!acc) return Promise.resolve({ count: 0 });
                // check condition
                if (gte !== undefined) {
                  if (acc.current_balance_cents >= gte) {
                    if (dec !== undefined) {
                      const before = acc.current_balance_cents;
                      const after = before - dec;
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    }
                    return Promise.resolve({ count: 1 });
                  }
                  return Promise.resolve({ count: 0 });
                }
                // fallback: no condition, apply decrement if present
                if (dec !== undefined) {
                  const before = acc.current_balance_cents;
                  const after = before - dec;
                  acc.current_balance_cents = after;
                  recordChange(id, before, after);
                  return Promise.resolve({ count: 1 });
                }
                return Promise.resolve({ count: 0 });
              },
            ),
            // update handles increment/decrement or absolute set
            update: jest.fn(
              (args: {
                where: { id: string };
                data: {
                  current_balance_cents?:
                    { increment?: bigint; decrement?: bigint } | bigint;
                };
              }) => {
                const id = args.where.id;
                const acc = accountsState[id];
                if (!acc) return Promise.resolve(null);
                const v = args.data.current_balance_cents;
                if (v && typeof v === 'object') {
                  if (v.increment !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before + v.increment;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  } else if (v.decrement !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before - v.decrement;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  }
                } else if (typeof v === 'bigint') {
                  const before = acc.current_balance_cents;
                  const after = v;
                  acc.current_balance_cents = after;
                  recordChange(id, before, after);
                }
                return Promise.resolve({
                  id: acc.id,
                  current_balance_cents: acc.current_balance_cents,
                });
              },
            ),
          },
          _rollback: () => {
            // revert only those changes that still match the 'after' value to avoid undoing other commits
            for (let i = changes.length - 1; i >= 0; i--) {
              const c = changes[i];
              if (accountsState[c.id].current_balance_cents === c.after) {
                accountsState[c.id].current_balance_cents = c.before;
              }
            }
          },
        };
        try {
          return cb(tx);
        } catch (err) {
          // rollback only this tx's changes
          tx._rollback();
          throw err;
        }
      }),
      transaction: { create: jest.fn(), findMany: jest.fn() },
    };

    // For crypto.randomUUID used inside service, stub a simple function
    const makeTransfersService = () =>
      new TransfersService(
        prismaMock as unknown as PrismaService,
        { record: jest.fn() } as unknown as AuditLogService,
        {
          validateForCreate: jest.fn(),
        } as unknown as TransactionValidationService,
      );

    const svc = makeTransfersService();

    // Two concurrent transfers from src -> dst, each 50000
    const t1 = svc.create('u1', {
      source_account_id: 'src',
      destination_account_id: 'dst',
      amount_cents: BigInt(50000),
    });
    const t2 = svc.create('u1', {
      source_account_id: 'src',
      destination_account_id: 'dst',
      amount_cents: BigInt(50000),
    });

    await Promise.all([t1, t2]);

    // After both operations, we expect the total deduction to be 100000 (initial 100000 -> 0)
    // Our mocked DB state is in accountsState
    expect(accountsState.src.current_balance_cents).toBe(BigInt(0));
  }, 20000);

  it('ensures only one of two concurrent transfers exceeding balance succeeds', async () => {
    const initialSrcBal = BigInt(100000);
    const initialDstBal = BigInt(50000);

    const accountsState: AccountStateMap = {
      src: {
        id: 'src',
        user_id: 'u1',
        current_balance_cents: initialSrcBal,
        deleted_at: null,
        is_active: true,
        currency: 'IDR',
      },
      dst: {
        id: 'dst',
        user_id: 'u1',
        current_balance_cents: initialDstBal,
        deleted_at: null,
        is_active: true,
        currency: 'IDR',
      },
    };

    const prismaMock: ConcurrencyPrismaMocks = {
      account: {
        findUnique: jest.fn((args: { where: { id: string } }) => {
          const a = accountsState[args.where.id];
          return Promise.resolve(a ? { ...a } : null);
        }),
      },
      $transaction: jest.fn((cb: (tx: ConcurrencyTx) => Promise<unknown>) => {
        const changes: { id: string; before: bigint; after: bigint }[] = [];
        const recordChange = (id: string, before: bigint, after: bigint) => {
          changes.push({ id, before, after });
        };
        const tx: ConcurrencyTx = {
          transaction: {
            create: jest.fn((args: { data: Record<string, unknown> }) =>
              Promise.resolve({
                id: cryptoId(),
                ...args.data,
                created_at: new Date(),
              }),
            ),
          },
          category: { findFirst: jest.fn(() => Promise.resolve(null)) },
          account: {
            updateMany: jest.fn(
              (args: {
                where: {
                  id: string;
                  current_balance_cents?: { gte?: bigint };
                };
                data: { current_balance_cents?: { decrement?: bigint } };
              }) => {
                const id = args.where.id;
                const gte = args.where.current_balance_cents?.gte;
                const dec = args.data.current_balance_cents?.decrement;
                const acc = accountsState[id];
                if (!acc) return Promise.resolve({ count: 0 });
                if (gte !== undefined) {
                  if (acc.current_balance_cents >= gte) {
                    if (dec !== undefined) {
                      const before = acc.current_balance_cents;
                      const after = before - dec;
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    }
                    return Promise.resolve({ count: 1 });
                  }
                  return Promise.resolve({ count: 0 });
                }
                if (dec !== undefined) {
                  const before = acc.current_balance_cents;
                  const after = before - dec;
                  acc.current_balance_cents = after;
                  recordChange(id, before, after);
                  return Promise.resolve({ count: 1 });
                }
                return Promise.resolve({ count: 0 });
              },
            ),
            update: jest.fn(
              (args: {
                where: { id: string };
                data: {
                  current_balance_cents?:
                    { increment?: bigint; decrement?: bigint } | bigint;
                };
              }) => {
                const id = args.where.id;
                const acc = accountsState[id];
                if (!acc) return Promise.resolve(null);
                const v = args.data.current_balance_cents;
                if (v && typeof v === 'object') {
                  if (v.increment !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before + v.increment;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  } else if (v.decrement !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before - v.decrement;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  }
                } else if (typeof v === 'bigint') {
                  const before = acc.current_balance_cents;
                  const after = v;
                  acc.current_balance_cents = after;
                  recordChange(id, before, after);
                }
                return Promise.resolve({
                  id: acc.id,
                  current_balance_cents: acc.current_balance_cents,
                });
              },
            ),
          },
          _rollback: () => {
            for (let i = changes.length - 1; i >= 0; i--) {
              const c = changes[i];
              if (accountsState[c.id].current_balance_cents === c.after) {
                accountsState[c.id].current_balance_cents = c.before;
              }
            }
          },
        };
        try {
          return cb(tx);
        } catch (err) {
          tx._rollback();
          throw err;
        }
      }),
      transaction: { create: jest.fn(), findMany: jest.fn() },
    };

    const svc = new TransfersService(
      prismaMock as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditLogService,
      {
        validateForCreate: jest.fn(),
      } as unknown as TransactionValidationService,
    );

    // Two concurrent transfers: 70000 and 50000
    const t1 = svc.create('u1', {
      source_account_id: 'src',
      destination_account_id: 'dst',
      amount_cents: BigInt(70000),
    });
    const t2 = svc.create('u1', {
      source_account_id: 'src',
      destination_account_id: 'dst',
      amount_cents: BigInt(50000),
    });

    const results = await Promise.allSettled([t1, t2]);

    // Exactly one should be fulfilled, one rejected
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Final balance should be 100000 - 70000 = 30000 (one succeeded)
    expect(accountsState.src.current_balance_cents).toBe(BigInt(30000));

    // Destination must have received money from exactly one successful transfer
    expect(
      accountsState.dst.current_balance_cents ===
        initialDstBal + BigInt(70000) ||
        accountsState.dst.current_balance_cents ===
          initialDstBal + BigInt(50000),
    ).toBe(true);
  }, 20000);
});

// small helper to produce pseudo ids
function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}
