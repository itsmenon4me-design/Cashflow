import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaAccountsRepository } from '../repositories/prisma-accounts.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { BalanceService } from './balance.service';
import { ErrorCode } from '../../../common/errors/error-codes';
import { AccountEntity } from '../entities/account.entity';

describe('AccountsService (create)', () => {
  let service: AccountsService;
  const repo = {
    findByUserAndName: jest.fn(),
    unsetDefaultForUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      PrismaAccountsRepository,
      'findByUserAndName' | 'unsetDefaultForUser' | 'create' | 'update'
    >
  >;
  const audit = { record: jest.fn() } as unknown as jest.Mocked<
    Pick<AuditLogService, 'record'>
  >;
  const balance = { recalculateAccount: jest.fn() } as unknown as jest.Mocked<
    Pick<BalanceService, 'recalculateAccount'>
  >;

  beforeEach(async () => {
    repo.findByUserAndName.mockReset();
    repo.unsetDefaultForUser.mockReset();
    repo.create.mockReset();
    repo.update.mockReset();
    audit.record.mockReset();
    balance.recalculateAccount.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaAccountsRepository, useValue: repo },
        { provide: AuditLogService, useValue: audit },
        { provide: BalanceService, useValue: balance },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('creates an account when the name is unique', async () => {
    const created: AccountEntity = {
      id: 'acc-1',
      user_id: 'user-1',
      name: 'Cash Test',
      account_type: 'CASH',
      currency: 'IDR',
      opening_balance_cents: 1000000n,
      current_balance_cents: 1000000n,
      color: null,
      icon: null,
      description: null,
      is_active: true,
      is_default: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };

    repo.findByUserAndName.mockResolvedValue(null);
    repo.create.mockResolvedValue(created);

    await expect(
      service.create('user-1', {
        name: 'Cash Test',
        account_type: 'CASH',
        currency: 'IDR',
        opening_balance_cents: 1000000,
      }),
    ).resolves.toMatchObject({ id: 'acc-1', name: 'Cash Test' });
  });

  it('passes opening_balance_cents as BigInt and sets current_balance_cents equal', async () => {
    repo.findByUserAndName.mockResolvedValue(null);
    // capture the create argument to assert BigInt conversion and parity
    // Return a minimal AccountEntity; we will inspect the call arguments instead of the return value.
    repo.create.mockImplementation(async () => {
      return {
        id: 'acc-2',
        user_id: 'user-1',
        name: 'Cash Test 2',
        account_type: 'CASH',
        currency: 'IDR',
        opening_balance_cents: 1000000n,
        current_balance_cents: 1000000n,
        color: null,
        icon: null,
        description: null,
        is_active: true,
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
    });

    await service.create('user-1', {
      name: 'Cash Test 2',
      account_type: 'CASH',
      currency: 'IDR',
      opening_balance_cents: 1000000,
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    const passed = repo.create.mock.calls[0][0];
    expect(passed.opening_balance_cents).toBe(BigInt(1000000));
    expect(passed.current_balance_cents).toBe(BigInt(1000000));
  });

  it('maps Prisma unique-constraint errors for duplicate account names to a conflict', async () => {
    repo.findByUserAndName.mockResolvedValue(null);
    repo.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create('user-1', {
        name: 'Cash Test',
        account_type: 'CASH',
        currency: 'IDR',
        opening_balance_cents: 1000000,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.CONFLICT });
  });
});
