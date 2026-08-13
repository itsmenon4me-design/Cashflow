import { BillsService } from './bills.service';
import { ErrorCode } from '../../../common/errors/error-codes';

describe('BillsService (ownership)', () => {
  let service: BillsService;
  let repoMock: any;
  let prismaMock: any;

  const bill = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    user_id: 'user-auth',
    payee: 'Electricity',
    amount_cents: BigInt(50000),
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
  } as any;

  const validCreate = {
    payee: 'Internet',
    amount_cents: 120000,
    currency: 'IDR',
    account_id: '11111111-2222-4333-8444-555555555555',
    category_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    due_date: '2026-09-01T00:00:00.000Z',
    due_date_timezone: 'Asia/Jakarta',
  } as any;

  const ownAccount = {
    id: validCreate.account_id,
    user_id: 'user-auth',
    deleted_at: null,
    is_active: true,
  };
  const ownCategory = {
    id: validCreate.category_id,
    user_id: 'user-auth',
    deleted_at: null,
    is_system: false,
  };

  beforeEach(() => {
    repoMock = {
      findAllByUser: jest.fn().mockResolvedValue([bill]),
      findUpcomingByUser: jest.fn().mockResolvedValue([bill]),
      findByIdOwned: jest.fn().mockResolvedValue(bill),
      updateOwned: jest.fn().mockResolvedValue(bill),
      softDeleteOwned: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue(bill),
    };
    prismaMock = {
      account: { findUnique: jest.fn().mockResolvedValue(ownAccount) },
      category: { findUnique: jest.fn().mockResolvedValue(ownCategory) },
    };
    service = new BillsService(repoMock, prismaMock);
  });

  const rejectsWith = async (promise: Promise<unknown>, code: ErrorCode) => {
    await expect(promise).rejects.toMatchObject({ errorCode: code });
  };

  it('create: rejects an account owned by another user', async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      id: validCreate.account_id,
      user_id: 'user-b',
      deleted_at: null,
      is_active: true,
    });
    await rejectsWith(
      service.create('user-auth', validCreate),
      ErrorCode.INVALID_INPUT,
    );
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('create: rejects an inactive account even when owned', async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      ...ownAccount,
      is_active: false,
    });
    await rejectsWith(
      service.create('user-auth', validCreate),
      ErrorCode.INVALID_INPUT,
    );
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('create: rejects a deleted account', async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      ...ownAccount,
      deleted_at: new Date(),
    });
    await rejectsWith(
      service.create('user-auth', validCreate),
      ErrorCode.INVALID_INPUT,
    );
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('create: rejects a private category owned by another user', async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: validCreate.category_id,
      user_id: 'user-b',
      deleted_at: null,
      is_system: false,
    });
    await rejectsWith(
      service.create('user-auth', validCreate),
      ErrorCode.INVALID_INPUT,
    );
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('create: allows a system category regardless of owner', async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: validCreate.category_id,
      user_id: 'user-b',
      deleted_at: null,
      is_system: true,
    });
    await service.create('user-auth', validCreate);
    expect(repoMock.create).toHaveBeenCalled();
  });

  it('create: allows own account and own category and passes user_id from auth', async () => {
    await service.create('user-auth', validCreate);
    expect(repoMock.create).toHaveBeenCalled();
    const input = repoMock.create.mock.calls[0][0];
    expect(input.user_id).toBe('user-auth');
    expect(input.amount_cents).toBe(BigInt(120000));
    expect(input.due_date).toBeInstanceOf(Date);
  });

  it('getById: returns a bill owned by the user', async () => {
    await expect(service.getById('user-auth', bill.id)).resolves.toEqual(bill);
    expect(repoMock.findByIdOwned).toHaveBeenCalledWith(bill.id, 'user-auth');
  });

  it('getById: other-user or missing bill surfaces as NOT_FOUND (no leak)', async () => {
    repoMock.findByIdOwned.mockResolvedValue(null);
    await rejectsWith(
      service.getById('user-auth', bill.id),
      ErrorCode.NOT_FOUND,
    );
  });

  it('update: passes authenticated userId into the owned repo call', async () => {
    await service.update('user-auth', bill.id, { payee: 'Water' });
    expect(repoMock.updateOwned).toHaveBeenCalled();
    const [id, userId] = repoMock.updateOwned.mock.calls[0];
    expect(id).toBe(bill.id);
    expect(userId).toBe('user-auth');
  });

  it('update: other-user bill cannot be updated (NOT_FOUND when repo returns null)', async () => {
    repoMock.findByIdOwned.mockResolvedValue(bill);
    repoMock.updateOwned.mockResolvedValue(null);
    await rejectsWith(
      service.update('user-auth', bill.id, { payee: 'Water' }),
      ErrorCode.NOT_FOUND,
    );
  });

  it('update: re-validates a new account reference on update', async () => {
    const otherAccountId = '99999999-8888-4777-8666-555555555555';
    prismaMock.account.findUnique.mockResolvedValue({
      id: otherAccountId,
      user_id: 'user-b',
      deleted_at: null,
      is_active: true,
    });
    await rejectsWith(
      service.update('user-auth', bill.id, { account_id: otherAccountId }),
      ErrorCode.INVALID_INPUT,
    );
    expect(repoMock.updateOwned).not.toHaveBeenCalled();
  });

  it('softDelete: other-user bill cannot be deleted (NOT_FOUND)', async () => {
    repoMock.softDeleteOwned.mockResolvedValue(false);
    await rejectsWith(
      service.softDelete('user-auth', bill.id),
      ErrorCode.NOT_FOUND,
    );
  });

  it('softDelete: own bill passes authenticated userId', async () => {
    await service.softDelete('user-auth', bill.id);
    expect(repoMock.softDeleteOwned).toHaveBeenCalledWith(bill.id, 'user-auth');
  });

  it('upcoming: scopes to authenticated userId and rejects inverted dates', async () => {
    await service.upcoming(
      'user-auth',
      '2026-09-01T00:00:00Z',
      '2026-12-01T00:00:00Z',
    );
    expect(repoMock.findUpcomingByUser).toHaveBeenCalled();
    const [userId, from, to] = repoMock.findUpcomingByUser.mock.calls[0];
    expect(userId).toBe('user-auth');
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
    await rejectsWith(
      service.upcoming(
        'user-auth',
        '2026-12-01T00:00:00Z',
        '2026-09-01T00:00:00Z',
      ),
      ErrorCode.INVALID_INPUT,
    );
  });
});
