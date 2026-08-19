import { AccountsService } from './services/accounts.service';
import { PrismaAccountsRepository } from './repositories/prisma-accounts.repository';
import { AuditLogService } from '../audit-logs/services/audit-log.service';
import { BalanceService } from './services/balance.service';

// Unit tests to assert currency-scoped uniqueness behavior

describe('Accounts Regression - soft-delete reuse & currency scoping', () => {
  let repoMock: Partial<PrismaAccountsRepository>;
  let service: AccountsService;

  beforeEach(() => {
    repoMock = {
      create: jest.fn().mockImplementation(async (input) => ({
        id: 'acc-new',
        ...input,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      } as any)),
      findByUserAndName: jest.fn().mockResolvedValue(null),
      unsetDefaultForUser: jest.fn().mockResolvedValue(undefined),
    };

    // @ts-ignore minimal dependencies
    const auditMock: any = { record: jest.fn().mockResolvedValue(undefined) };
    const balanceMock: any = { recalculateAccount: jest.fn().mockResolvedValue(undefined) };
    service = new AccountsService(repoMock as any, auditMock as any, balanceMock as any);
  });

  it('uses currency when checking uniqueness on create', async () => {
    const createInput = { name: 'BCA', currency: 'IDR' } as any;
    await service.create('user-1', createInput);
    expect((repoMock.findByUserAndName as jest.Mock).mock.calls[0][0]).toBe('user-1');
    expect((repoMock.findByUserAndName as jest.Mock).mock.calls[0][1]).toBe('BCA');
    expect((repoMock.findByUserAndName as jest.Mock).mock.calls[0][2]).toBe('IDR');
  });

  it('prevents changing currency on update', async () => {
    // mock getById
    (service as any).getById = jest.fn().mockResolvedValue({ id: 'acc-1', user_id: 'user-1', currency: 'IDR', name: 'BCA'});
    await expect(service.update('user-1', 'acc-1', { currency: 'USD' } as any)).rejects.toThrow();
  });
});
