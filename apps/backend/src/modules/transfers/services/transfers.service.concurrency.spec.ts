import { TransfersService } from './transfers.service';
import type { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';

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
    const accountsState: Record<
      string,
      {
        id: string;
        user_id: string;
        current_balance_cents: bigint;
        deleted_at: null | Date;
        is_active: boolean;
        currency: string;
      }
    > = {
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
    const prismaMock: Partial<PrismaService> = {
      account: {
        // findUnique called before $transaction in TransfersService; return a snapshot of the account
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const a = accountsState[where.id];
          return Promise.resolve(a ? { ...a } : null);
        }),
      } as any,
      // $transaction executes callback with a tx that manipulates the shared accountsState atomically
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        // Snapshot accountsState to allow rollback in case of thrown error
        const snapshot: Record<string, bigint> = {};
        for (const k of Object.keys(accountsState)) {
          snapshot[k] = accountsState[k].current_balance_cents;
        }

        const tx = (() => {
          // per-transaction change log to support rollback without undoing other committed txs
          const changes: { id: string; before: bigint; after: bigint }[] = [];
          const recordChange = (id: string, before: bigint, after: bigint) => {
            changes.push({ id, before, after });
          };

          return {
            transaction: {
              create: jest.fn().mockImplementation((args: any) => {
                return Promise.resolve({
                  id: cryptoId(),
                  ...args.data,
                  created_at: new Date(),
                });
              }),
            },
            category: { findFirst: jest.fn().mockResolvedValue(null) },
            account: {
              // updateMany simulates conditional atomic decrement: if balance >= amount then decrement and return count:1
              updateMany: jest
                .fn()
                .mockImplementation(async ({ where, data }: any) => {
                  const id = where.id;
                  const gte = where.current_balance_cents?.gte as
                    bigint | undefined;
                  const dec = data.current_balance_cents?.decrement as
                    bigint | undefined;
                  // ensure account exists
                  const acc = accountsState[id];
                  if (!acc) return { count: 0 };
                  // check condition
                  if (gte !== undefined) {
                    if (acc.current_balance_cents >= gte) {
                      if (dec !== undefined) {
                        const before = acc.current_balance_cents;
                        const after = before - dec;
                        acc.current_balance_cents = after;
                        recordChange(id, before, after);
                      }
                      return { count: 1 };
                    }
                    return { count: 0 };
                  }
                  // fallback: no condition, apply decrement if present
                  if (dec !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before - dec;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                    return { count: 1 };
                  }
                  return { count: 0 };
                }),
              // update handles increment/decrement or absolute set
              update: jest
                .fn()
                .mockImplementation(async ({ where, data }: any) => {
                  const id = where.id;
                  const acc = accountsState[id];
                  if (!acc) return null;
                  const v = data.current_balance_cents;
                  if (v && typeof v === 'object') {
                    if ('increment' in v) {
                      const before = acc.current_balance_cents;
                      const after = before + (v.increment as bigint);
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    } else if ('decrement' in v) {
                      const before = acc.current_balance_cents;
                      const after = before - (v.decrement as bigint);
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    }
                  } else if (typeof v === 'bigint') {
                    const before = acc.current_balance_cents;
                    const after = v;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  }
                  return {
                    id: acc.id,
                    current_balance_cents: acc.current_balance_cents,
                  };
                }),
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
          } as any;
        })();
        try {
          return await cb(tx);
        } catch (err) {
          // rollback only this tx's changes
          tx._rollback();
          throw err;
        }
      }),
      transaction: { create: jest.fn(), findMany: jest.fn() } as any,
    };

    // For crypto.randomUUID used inside service, stub a simple function
    const makeTransfersService = () =>
      new TransfersService(
        prismaMock as PrismaService,
        { record: jest.fn() } as any,
        { validateForCreate: jest.fn() } as any,
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

    const accountsState: Record<
      string,
      {
        id: string;
        user_id: string;
        current_balance_cents: bigint;
        deleted_at: null | Date;
        is_active: boolean;
        currency: string;
      }
    > = {
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

    const prismaMock: Partial<PrismaService> = {
      account: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const a = accountsState[where.id];
          return Promise.resolve(a ? { ...a } : null);
        }),
      } as any,
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        const snapshot: Record<string, bigint> = {};
        for (const k of Object.keys(accountsState)) {
          snapshot[k] = accountsState[k].current_balance_cents;
        }

        const tx = (() => {
          const changes: { id: string; before: bigint; after: bigint }[] = [];
          const recordChange = (id: string, before: bigint, after: bigint) => {
            changes.push({ id, before, after });
          };
          return {
            transaction: {
              create: jest.fn().mockImplementation((args: any) =>
                Promise.resolve({
                  id: cryptoId(),
                  ...args.data,
                  created_at: new Date(),
                }),
              ),
            },
            category: { findFirst: jest.fn().mockResolvedValue(null) },
            account: {
              updateMany: jest
                .fn()
                .mockImplementation(async ({ where, data }: any) => {
                  const id = where.id;
                  const gte = where.current_balance_cents?.gte as
                    bigint | undefined;
                  const dec = data.current_balance_cents?.decrement as
                    bigint | undefined;
                  const acc = accountsState[id];
                  if (!acc) return { count: 0 };
                  if (gte !== undefined) {
                    if (acc.current_balance_cents >= gte) {
                      if (dec !== undefined) {
                        const before = acc.current_balance_cents;
                        const after = before - dec;
                        acc.current_balance_cents = after;
                        recordChange(id, before, after);
                      }
                      return { count: 1 };
                    }
                    return { count: 0 };
                  }
                  if (dec !== undefined) {
                    const before = acc.current_balance_cents;
                    const after = before - dec;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                    return { count: 1 };
                  }
                  return { count: 0 };
                }),
              update: jest
                .fn()
                .mockImplementation(async ({ where, data }: any) => {
                  const id = where.id;
                  const acc = accountsState[id];
                  if (!acc) return null;
                  const v = data.current_balance_cents;
                  if (v && typeof v === 'object') {
                    if ('increment' in v) {
                      const before = acc.current_balance_cents;
                      const after = before + (v.increment as bigint);
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    } else if ('decrement' in v) {
                      const before = acc.current_balance_cents;
                      const after = before - (v.decrement as bigint);
                      acc.current_balance_cents = after;
                      recordChange(id, before, after);
                    }
                  } else if (typeof v === 'bigint') {
                    const before = acc.current_balance_cents;
                    const after = v;
                    acc.current_balance_cents = after;
                    recordChange(id, before, after);
                  }
                  return {
                    id: acc.id,
                    current_balance_cents: acc.current_balance_cents,
                  };
                }),
            },
            _rollback: () => {
              for (let i = changes.length - 1; i >= 0; i--) {
                const c = changes[i];
                if (accountsState[c.id].current_balance_cents === c.after) {
                  accountsState[c.id].current_balance_cents = c.before;
                }
              }
            },
          } as any;
        })();
        try {
          return await cb(tx);
        } catch (err) {
          tx._rollback();
          throw err;
        }
      }),
      transaction: { create: jest.fn(), findMany: jest.fn() } as any,
    };

    const svc = new TransfersService(
      prismaMock as PrismaService,
      { record: jest.fn() } as any,
      { validateForCreate: jest.fn() } as any,
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
