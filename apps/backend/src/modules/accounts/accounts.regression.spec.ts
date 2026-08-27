import { AccountsService } from './services/accounts.service';
import { PrismaAccountsRepository } from './repositories/prisma-accounts.repository';
import { AuditLogService } from '../audit-logs/services/audit-log.service';
import { BalanceService } from './services/balance.service';

// Unit tests to assert account name uniqueness behavior

describe('Accounts Regression - soft-delete reuse & uniqueness', () => {
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

  it('checks name uniqueness on create', async () => {
    const createInput = { name: 'BCA', currency: 'IDR' } as any;
    await service.create('user-1', createInput);
    expect((repoMock.findByUserAndName as jest.Mock).mock.calls[0][0]).toBe('user-1');
    expect((repoMock.findByUserAndName as jest.Mock).mock.calls[0][1]).toBe('BCA');
  });
});
