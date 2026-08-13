import { PrismaBillsRepository } from './prisma-bills.repository';

describe('PrismaBillsRepository (IDOR scoping)', () => {
  let repo: PrismaBillsRepository;
  let prismaMock: any;

  const billId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const record = {
    id: billId,
    user_id: 'user-auth',
    payee: 'Electricity',
    amount_cents: 50000n,
    currency: 'IDR',
    account_id: '11111111-2222-4333-8444-555555555555',
    category_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    due_date: new Date('2026-09-01T00:00:00Z'),
    due_date_timezone: 'Asia/Jakarta',
    is_paid: false,
    paid_at: null,
    transaction_id: null,
    status: 'OPEN',
    recurrence_type: 'NONE',
    recurrence_interval: null,
    recurrence_ends_at: null,
    series_id: null,
    is_template: false,
    reminder_enabled: true,
    reminder_days_before: 1,
    reminder_time: null,
    reminder_config: null,
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-01T00:00:00Z'),
    deleted_at: null,
  };

  beforeEach(() => {
    prismaMock = {
      bill: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    repo = new PrismaBillsRepository(prismaMock);
  });

  it('findByIdOwned scopes the WHERE by id AND user_id', async () => {
    prismaMock.bill.findFirst.mockResolvedValue(record);
    await repo.findByIdOwned(billId, 'user-auth');
    expect(prismaMock.bill.findFirst).toHaveBeenCalledWith({
      where: { id: billId, user_id: 'user-auth', deleted_at: null },
    });
  });

  it('findAllByUser scopes by user_id', async () => {
    prismaMock.bill.findMany.mockResolvedValue([record]);
    await repo.findAllByUser('user-auth');
    const arg = prismaMock.bill.findMany.mock.calls[0][0];
    expect(arg.where.user_id).toBe('user-auth');
    expect(arg.where.deleted_at).toBeNull();
  });

  it('findUpcomingByUser scopes by user_id and date window', async () => {
    prismaMock.bill.findMany.mockResolvedValue([record]);
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-12-01T00:00:00Z');
    await repo.findUpcomingByUser('user-auth', from, to);
    const arg = prismaMock.bill.findMany.mock.calls[0][0];
    expect(arg.where.user_id).toBe('user-auth');
    expect(arg.where.due_date).toEqual({ gte: from, lte: to });
  });

  it('updateOwned: refuses to update a bill not owned by the user', async () => {
    prismaMock.bill.findFirst.mockResolvedValue(null);
    const result = await repo.updateOwned(billId, 'user-b', {
      payee: 'Hacked',
    });
    expect(result).toBeNull();
    expect(prismaMock.bill.update).not.toHaveBeenCalled();
  });

  it('updateOwned: updates an owned bill with a scalar WHERE on id', async () => {
    prismaMock.bill.findFirst.mockResolvedValue({ id: billId });
    prismaMock.bill.update.mockResolvedValue(record);
    await repo.updateOwned(billId, 'user-auth', { payee: 'Water' });
    expect(prismaMock.bill.findFirst).toHaveBeenCalledWith({
      where: { id: billId, user_id: 'user-auth', deleted_at: null },
      select: { id: true },
    });
    expect(prismaMock.bill.update).toHaveBeenCalledWith({
      where: { id: billId },
      data: { payee: 'Water' },
    });
  });

  it('softDeleteOwned: refuses to delete a bill not owned by the user', async () => {
    prismaMock.bill.findFirst.mockResolvedValue(null);
    const deleted = await repo.softDeleteOwned(billId, 'user-b');
    expect(deleted).toBe(false);
    expect(prismaMock.bill.update).not.toHaveBeenCalled();
  });

  it('softDeleteOwned: soft-deletes only after an ownership check', async () => {
    prismaMock.bill.findFirst.mockResolvedValue({ id: billId });
    prismaMock.bill.update.mockResolvedValue({
      ...record,
      deleted_at: new Date(),
    });
    const deleted = await repo.softDeleteOwned(billId, 'user-auth');
    expect(deleted).toBe(true);
    expect(prismaMock.bill.findFirst).toHaveBeenCalledWith({
      where: { id: billId, user_id: 'user-auth', deleted_at: null },
      select: { id: true },
    });
    expect(prismaMock.bill.update).toHaveBeenCalledWith({
      where: { id: billId },
      data: { deleted_at: expect.any(Date) },
    });
  });

  it('create: persists user_id straight from the caller input (never reads client body)', async () => {
    prismaMock.bill.create.mockResolvedValue(record);
    await repo.create({
      user_id: 'user-auth',
      payee: 'Electricity',
      amount_cents: 50000n,
      currency: 'IDR',
      account_id: '11111111-2222-4333-8444-555555555555',
      category_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
      due_date: record.due_date,
      due_date_timezone: 'Asia/Jakarta',
      status: 'OPEN',
    });
    expect(prismaMock.bill.create).toHaveBeenCalled();
    const data = prismaMock.bill.create.mock.calls[0][0].data;
    expect(data.user_id).toBe('user-auth');
  });
});
