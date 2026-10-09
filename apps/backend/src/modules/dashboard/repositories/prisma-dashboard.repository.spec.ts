import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '../../../generated/prisma/client';
import { DateHelper } from '../../../common/utils/date.util';
import { PrismaDashboardRepository } from './prisma-dashboard.repository';

describe('PrismaDashboardRepository', () => {
  const transaction = {
    groupBy: jest.fn(),
    count: jest.fn(),
  };
  const category = { count: jest.fn() };
  const repository = new PrismaDashboardRepository({
    transaction,
    category,
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('separates lifetime balance from monthly cash flow and compares calendar months', async () => {
    const monthStart = DateHelper.startOfMonth(2025, 1);
    const monthEnd = DateHelper.endOfMonth(2025, 1);
    const previousMonthStart = DateHelper.startOfMonth(2024, 12);

    transaction.groupBy
      .mockResolvedValueOnce([
        {
          transaction_type: TransactionType.INCOME,
          _sum: { amount_cents: 1200n },
          _max: { updated_at: new Date('2025-01-10T00:00:00.000Z') },
        },
        {
          transaction_type: TransactionType.EXPENSE,
          _sum: { amount_cents: 500n },
          _max: { updated_at: new Date('2025-01-12T00:00:00.000Z') },
        },
      ])
      .mockResolvedValueOnce([
        {
          transaction_type: TransactionType.INCOME,
          _sum: { amount_cents: 100000n },
        },
        {
          transaction_type: TransactionType.EXPENSE,
          _sum: { amount_cents: 23100n },
        },
      ])
      .mockResolvedValueOnce([
        {
          transaction_type: TransactionType.INCOME,
          _sum: { amount_cents: 2000n },
        },
        {
          transaction_type: TransactionType.EXPENSE,
          _sum: { amount_cents: 1200n },
        },
      ]);
    category.count.mockResolvedValue(5);
    transaction.count.mockResolvedValue(38);

    const result = await repository.getSummary(
      'user-1',
      monthStart,
      monthEnd,
      'Asia/Jakarta',
    );

    expect(result.total_assets_cents).toBe('76900');
    expect(result.total_income_cents).toBe('1200');
    expect(result.total_expense_cents).toBe('500');
    expect(result.net_cash_flow_cents).toBe('700');
    expect(result.previous_net_cash_flow_cents).toBe('800');
    expect(result.last_updated_at).toEqual(
      new Date('2025-01-12T00:00:00.000Z'),
    );

    expect(transaction.groupBy).toHaveBeenNthCalledWith(1, {
      where: {
        user_id: 'user-1',
        deleted_at: null,
        transaction_date: { gte: monthStart, lte: monthEnd },
      },
      by: ['transaction_type'],
      _sum: { amount_cents: true },
      _max: { updated_at: true },
    });
    expect(transaction.groupBy).toHaveBeenNthCalledWith(2, {
      where: {
        user_id: 'user-1',
        deleted_at: null,
      },
      by: ['transaction_type'],
      _sum: { amount_cents: true },
    });
    expect(transaction.groupBy).toHaveBeenNthCalledWith(3, {
      where: {
        user_id: 'user-1',
        deleted_at: null,
        transaction_date: { gte: previousMonthStart, lt: monthStart },
      },
      by: ['transaction_type'],
      _sum: { amount_cents: true },
    });
    expect(category.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', deleted_at: null },
    });
    expect(transaction.count).toHaveBeenCalledWith({
      where: { user_id: 'user-1', deleted_at: null },
    });
  });
});
