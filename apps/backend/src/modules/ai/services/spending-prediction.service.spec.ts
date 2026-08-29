import { SpendingPredictionService } from './spending-prediction.service';
import type { PrismaService } from '../../../database/prisma.service';

const FIXED_NOW = new Date('2026-05-15T00:00:00Z');
const WINDOW = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
];

type TxRecord = {
  id: string;
  user_id: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  amount_cents: bigint;
  transaction_date: Date;
  category_id: string;
  transfer_group_id: string | null;
};

type TxQuery = {
  where: {
    user_id: string;
    deleted_at: null;
    transaction_date: { gte: Date; lt: Date };
  };
};

type CategoryRecord = { id: string; user_id: string; name: string };

type CategoryQuery = {
  where: { id: { in: string[] }; user_id: string; deleted_at: null };
};

const makeTx = (
  month: string,
  type: 'INCOME' | 'EXPENSE',
  cents: number | bigint,
  categoryId: string,
  transferGroupId: string | null = null,
): TxRecord => ({
  id: `tx-${month}-${categoryId}-${type}`,
  user_id: 'u1',
  transaction_type: type,
  amount_cents: BigInt(cents),
  transaction_date: new Date(`${month}-15T12:00:00Z`),
  category_id: categoryId,
  transfer_group_id: transferGroupId,
});

const CAT = {
  food: 'cat-food',
  transport: 'cat-transport',
  income: 'cat-income',
};

const categoryRows = (): CategoryRecord[] => [
  { id: CAT.food, user_id: 'u1', name: 'Food' },
  { id: CAT.transport, user_id: 'u1', name: 'Transport' },
  { id: CAT.income, user_id: 'u1', name: 'Income' },
];

const makeFindMany = (rows: TxRecord[]) =>
  jest.fn<Promise<TxRecord[]>, [TxQuery]>().mockResolvedValue(rows);

const makeFindCategories = (rows: CategoryRecord[]) =>
  jest.fn<Promise<CategoryRecord[]>, [CategoryQuery]>().mockResolvedValue(rows);

type AccountRecord = { currency: string; is_default: boolean };

type AccountQuery = {
  where: { user_id: string; deleted_at: null };
  select: { currency: true; is_default: true };
};

const makeFindAccounts = (rows: AccountRecord[]) =>
  jest.fn<Promise<AccountRecord[]>, [AccountQuery]>().mockResolvedValue(rows);

type PrismaMock = {
  userSettings: { findUnique: jest.Mock };
  transaction: { findMany: ReturnType<typeof makeFindMany> };
  category: { findMany: ReturnType<typeof makeFindCategories> };
  account: { findMany: ReturnType<typeof makeFindAccounts> };
};

const makeService = (overrides?: Partial<PrismaMock>) => {
  const prisma = {
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
    },
    transaction: { findMany: makeFindMany([]) },
    category: { findMany: makeFindCategories(categoryRows()) },
    account: {
      findMany: makeFindAccounts([{ currency: 'IDR', is_default: true }]),
    },
    ...overrides,
  };
  const service = new SpendingPredictionService(
    prisma as unknown as PrismaService,
  );
  service.clock = () => new Date(FIXED_NOW.getTime());
  return { service, prisma };
};

const stableMonths = (
  monthlyFood: number,
  monthlyTransport: number,
): TxRecord[] =>
  WINDOW.slice(3).flatMap((month) => [
    makeTx(month, 'EXPENSE', monthlyFood, CAT.food),
    makeTx(month, 'EXPENSE', monthlyTransport, CAT.transport),
  ]);

describe('SpendingPredictionService', () => {
  it('A. predicts total and category spending from a stable history', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(false);
    expect(res.period).toBe('2026-06');
    expect(res.predictedTotalCents).toBe('500000');
    expect(res.categories).toHaveLength(2);

    const food = res.categories.find((c) => c.categoryId === CAT.food);
    const transport = res.categories.find(
      (c) => c.categoryId === CAT.transport,
    );
    expect(food?.categoryName).toBe('Food');
    expect(food?.predictedAmountCents).toBe('300000');
    expect(food?.basedOnMonths).toBe(3);
    expect(food?.confidence).toBe(0.75);
    expect(transport?.predictedAmountCents).toBe('200000');
    expect(transport?.basedOnMonths).toBe(3);

    expect(res.otherCents).toBe('0');
    expect(res.confidence).toBe(0.65);
    expect(res.noHistoryCategoryIds).toEqual([]);
  });

  it('B. returns insufficientData when there is no history', async () => {
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany([]) },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(true);
    expect(res.currency).toBe('IDR');
    expect(res.predictedTotalCents).toBe('0');
    expect(res.confidence).toBe(0);
    expect(res.categories).toEqual([]);
    expect(res.otherCents).toBe('0');
    expect(res.period).toBe('2026-06');
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('C. provides a low-confidence total from a single month', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-04', 'EXPENSE', 250000, CAT.food),
          makeTx('2026-04', 'EXPENSE', 150000, CAT.transport),
        ]),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(false);
    expect(res.predictedTotalCents).toBe('400000');
    expect(res.confidence).toBeLessThanOrEqual(0.4);
    expect(res.categories).toEqual([]);
    expect(res.otherCents).toBe('400000');
  });

  it('D. predicts deterministically from two months with limited confidence', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-03', 'EXPENSE', 200000, CAT.food),
          makeTx('2026-04', 'EXPENSE', 300000, CAT.food),
        ]),
      },
    });

    const first = await service.predict('u1', { horizon: 1 });
    const second = await service.predict('u1', { horizon: 1 });

    expect(first).toEqual(second);
    expect(first.insufficientData).toBe(false);
    expect(first.predictedTotalCents).toBe('266666');
    expect(first.confidence).toBeLessThanOrEqual(0.6);

    const food = first.categories[0];
    expect(food.categoryId).toBe(CAT.food);
    expect(food.predictedAmountCents).toBe('266666');
    expect(food.basedOnMonths).toBe(2);
    expect(food.confidence).toBeLessThanOrEqual(0.4);
    expect(first.otherCents).toBe('0');
  });

  it('E. keeps multiple category predictions distinct', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          WINDOW.slice(4).flatMap((month) => [
            makeTx(month, 'EXPENSE', 100000, CAT.food),
            makeTx(month, 'EXPENSE', 200000, CAT.transport),
          ]),
        ),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const byId = new Map(res.categories.map((c) => [c.categoryId, c]));
    expect(byId.get(CAT.food)?.predictedAmountCents).toBe('100000');
    expect(byId.get(CAT.transport)?.predictedAmountCents).toBe('200000');
    expect(res.predictedTotalCents).toBe('300000');
    expect(res.categories.length).toBe(2);
  });

  it('F. reports a low-confidence category with insufficient basis', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-02', 'EXPENSE', 300000, CAT.food),
          makeTx('2026-03', 'EXPENSE', 300000, CAT.food),
          makeTx('2026-04', 'EXPENSE', 300000, CAT.food),
          makeTx('2026-03', 'EXPENSE', 100000, CAT.transport),
          makeTx('2026-04', 'EXPENSE', 100000, CAT.transport),
        ]),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const transport = res.categories.find(
      (c) => c.categoryId === CAT.transport,
    );
    expect(transport?.basedOnMonths).toBe(2);
    expect(transport?.confidence).toBeLessThanOrEqual(0.4);
    expect(transport?.predictedAmountCents).toBe('100000');
  });

  it('G. excludes zero-spending categories', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          ...stableMonths(300000, 200000),
          makeTx('2026-04', 'INCOME', 999999, CAT.income),
        ]),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const ids = res.categories.map((c) => c.categoryId);
    expect(ids).not.toContain(CAT.income);
    expect(res.categories).toHaveLength(2);
  });

  it('H. does not fabricate predictions for new categories', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.categories.map((c) => c.categoryId)).toEqual(
      expect.not.arrayContaining(['cat-brand-new']),
    );
    expect(res.predictedTotalCents).toBe('500000');
  });

  it('I. removes a 3-sigma outlier without emptying the basis', async () => {
    const months = WINDOW.slice(2);
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          months.map((month) =>
            makeTx(
              month,
              'EXPENSE',
              month === '2026-01' ? 100000000 : 100000,
              CAT.food,
            ),
          ),
        ),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const food = res.categories[0];
    expect(food.basedOnMonths).toBe(3);
    expect(food.predictedAmountCents).toBe('100000');
    expect(res.predictedTotalCents).toBe('100000');
  });

  it('J/K. lowers confidence for volatile history vs stable history', async () => {
    const volatile = makeService({
      transaction: {
        findMany: makeFindMany(
          WINDOW.map((month, i) =>
            makeTx(month, 'EXPENSE', i % 2 === 0 ? 100000 : 900000, CAT.food),
          ),
        ),
      },
    });
    const stable = makeService({
      transaction: {
        findMany: makeFindMany(
          WINDOW.map((month) => makeTx(month, 'EXPENSE', 500000, CAT.food)),
        ),
      },
    });

    const volatileRes = await volatile.service.predict('u1', { horizon: 1 });
    const stableRes = await stable.service.predict('u1', { horizon: 1 });

    expect(stableRes.confidence).toBe(1);
    expect(volatileRes.confidence).toBeLessThan(stableRes.confidence);
    expect(volatileRes.confidence).toBeGreaterThanOrEqual(0);
    expect(volatileRes.confidence).toBeLessThanOrEqual(1);
  });

  it('L. includes transfer expenses', async () => {
    const txs = [
      makeTx('2026-02', 'EXPENSE', 300000, CAT.food),
      makeTx('2026-03', 'EXPENSE', 300000, CAT.food),
      makeTx('2026-04', 'EXPENSE', 300000, CAT.food),
      makeTx('2026-02', 'EXPENSE', 100000, CAT.transport, 'group-1'),
      makeTx('2026-03', 'EXPENSE', 100000, CAT.transport, 'group-2'),
      makeTx('2026-04', 'EXPENSE', 100000, CAT.transport, 'group-3'),
    ];
    const { service, prisma } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(res.predictedTotalCents).toBe('400000');
    expect(
      res.categories.find((c) => c.categoryId === CAT.transport),
    ).toMatchObject({ predictedAmountCents: '100000' });
  });

  it('M. excludes income from spending', async () => {
    const txs = [
      makeTx('2026-04', 'INCOME', 9000000, CAT.income),
      makeTx('2026-04', 'EXPENSE', 400000, CAT.food),
    ];
    const { service } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.predictedTotalCents).toBe('400000');
    expect(res.categories.map((c) => c.categoryId)).not.toContain(CAT.income);
  });

  it('N. scopes every query to the requesting user', async () => {
    const { service, prisma } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    await service.predict('other-user-id', { horizon: 1 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('other-user-id');

    const [catQuery] = prisma.category.findMany.mock.calls[0];
    expect(catQuery.where.user_id).toBe('other-user-id');
    expect(catQuery.where.id.in).toEqual([CAT.food, CAT.transport]);
  });

  it('O. excludes deleted transactions', async () => {
    const { service, prisma } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    await service.predict('u1', { horizon: 1 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.deleted_at).toBeNull();
  });

  it('P. buckets transactions by the user timezone', async () => {
    const { service } = makeService({
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Jakarta' }),
      },
      transaction: {
        findMany: makeFindMany([
          {
            id: 'tx-boundary-1',
            user_id: 'u1',
            transaction_type: 'EXPENSE',
            amount_cents: BigInt(1000),
            transaction_date: new Date('2026-03-31T16:59:59Z'),
            category_id: CAT.food,
            transfer_group_id: null,
          },
          {
            id: 'tx-boundary-2',
            user_id: 'u1',
            transaction_type: 'EXPENSE',
            amount_cents: BigInt(2000),
            transaction_date: new Date('2026-03-31T17:00:00Z'),
            category_id: CAT.food,
            transfer_group_id: null,
          },
          {
            id: 'tx-boundary-3',
            user_id: 'u1',
            transaction_type: 'EXPENSE',
            amount_cents: BigInt(3000),
            transaction_date: new Date('2026-04-01T00:00:00Z'),
            category_id: CAT.food,
            transfer_group_id: null,
          },
        ]),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(false);
    expect(res.predictedTotalCents).toBe('3666');
  });

  it('Q. is deterministic for identical input', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const a = await service.predict('u1', { horizon: 1 });
    const b = await service.predict('u1', { horizon: 1 });

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('R. preserves big-integer cent precision', async () => {
    const huge = 9007199254740993n;
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          WINDOW.slice(2).map((month) =>
            makeTx(month, 'EXPENSE', huge, CAT.food),
          ),
        ),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.predictedTotalCents).toBe('9007199254740993');
    const food = res.categories[0];
    expect(food.predictedAmountCents).toBe('9007199254740993');
  });

  it('S. handles empty/zero expense without NaN or Infinity', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany([
          makeTx('2026-04', 'EXPENSE', 0, CAT.food),
          makeTx('2026-04', 'INCOME', 500000, CAT.income),
        ]),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(true);
    expect(res.currency).toBe('IDR');
    expect(res.predictedTotalCents).toBe('0');
    expect(res.otherCents).toBe('0');
    expect(res.confidence).toBe(0);
    expect(res.confidence).not.toBeNaN();
    expect(res.confidence).toBeLessThan(Infinity);
  });

  it('T. resolves category names with a single query', async () => {
    const { service, prisma } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    await service.predict('u1', { horizon: 1 });

    expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
    const [catQuery] = prisma.category.findMany.mock.calls[0];
    expect(catQuery.where.id.in).toEqual([CAT.food, CAT.transport]);
    expect(catQuery.where.deleted_at).toBeNull();
  });

  it('U. does not dilute averages with missing months', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          ['2026-02', '2026-03', '2026-04'].map((month) =>
            makeTx(month, 'EXPENSE', 300000, CAT.food),
          ),
        ),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(false);
    expect(res.predictedTotalCents).toBe('300000');
    expect(res.categories[0].predictedAmountCents).toBe('300000');
    expect(res.categories[0].basedOnMonths).toBe(3);
  });

  it('V. returns only the documented contract fields with string money values', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(Object.keys(res).sort()).toEqual([
      'categories',
      'confidence',
      'currency',
      'insufficientData',
      'noHistoryCategoryIds',
      'otherCents',
      'period',
      'predictedTotalCents',
    ]);
    expect(Object.keys(res.categories[0]).sort()).toEqual([
      'basedOnMonths',
      'categoryId',
      'categoryName',
      'confidence',
      'predictedAmountCents',
    ]);
    expect(res.predictedTotalCents).toMatch(/^\d+$/);
    expect(res.categories[0].predictedAmountCents).toMatch(/^\d+$/);
    expect(res.otherCents).toMatch(/^\d+$/);
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
    expect(Object.keys(res)).not.toContain('transactions');
    expect(Object.keys(res)).not.toContain('accounts');
    expect(Object.keys(res)).not.toContain('transfer_group_id');
  });

  it('W. always uses IDR fixed currency', async () => {
    const { service, prisma } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    const [txQuery] = prisma.transaction.findMany.mock.calls[0];
    expect(txQuery.where.user_id).toBe('u1');
    expect(txQuery.where.deleted_at).toBeNull();
    expect(res.currency).toBe('IDR');
  });

  it('X. preserves arbitrary non-round IDR minor-unit values exactly', async () => {
    const amounts = [1n, 7n, 17n, 137n, 501n, 999n, 1001n, 1234567n];
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(
          amounts.map((amt, i) =>
            makeTx('2026-04', 'EXPENSE', amt, `cat-${i}`),
          ),
        ),
      },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.currency).toBe('IDR');
    expect(res.predictedTotalCents).toBe('1237230');
    expect(res.otherCents).toBe('1237230');
  });

  it('Z. buckets multiple transactions on the same day into one month', async () => {
    const txs = [
      {
        ...makeTx('2026-04', 'EXPENSE', 100, CAT.food),
        id: 'tx-same-day-1',
        transaction_date: new Date('2026-04-10T07:00:00Z'),
      },
      {
        ...makeTx('2026-04', 'EXPENSE', 200, CAT.food),
        id: 'tx-same-day-2',
        transaction_date: new Date('2026-04-10T12:00:00Z'),
      },
      {
        ...makeTx('2026-04', 'EXPENSE', 400, CAT.food),
        id: 'tx-same-day-3',
        transaction_date: new Date('2026-04-10T18:00:00Z'),
      },
    ];
    const { service } = makeService({
      transaction: { findMany: makeFindMany(txs) },
    });

    const res = await service.predict('u1', { horizon: 1 });

    expect(res.insufficientData).toBe(false);
    expect(res.predictedTotalCents).toBe('700');
    expect(res.otherCents).toBe('700');
  });

  it('AB. exposes the resolved currency in normal and insufficient responses', async () => {
    const normal = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });
    const empty = makeService({
      transaction: { findMany: makeFindMany([]) },
    });

    const normalRes = await normal.service.predict('u1', { horizon: 1 });
    const emptyRes = await empty.service.predict('u1', { horizon: 1 });

    expect(normalRes.currency).toBe('IDR');
    expect(normalRes.insufficientData).toBe(false);
    expect(emptyRes.currency).toBe('IDR');
    expect(emptyRes.insufficientData).toBe(true);
  });

  it('AC. handles out-of-range horizon input defensively', async () => {
    const { service } = makeService({
      transaction: {
        findMany: makeFindMany(stableMonths(300000, 200000)),
      },
    });

    const below = await service.predict('u1', { horizon: 0 });
    const above = await service.predict('u1', { horizon: 99 });

    expect(below.period).toBe('2026-06');
    expect(above.period).toBe('2026-06');
    expect(below.predictedTotalCents).toBe('500000');
    expect(above.predictedTotalCents).toBe('500000');
  });
});
