import { BudgetsService } from './budgets.service';
import { PrismaBudgetsRepository } from '../repositories/prisma-budgets.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { PrismaService } from '../../../database/prisma.service';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { UserSettingsService } from '../../settings/services/user-settings.service';

const makeRepoMock = (overrides: Record<string, unknown> = {}) => {
  return {
    findByUserAndCategoryAndPeriod: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockImplementation((input: Partial<Record<string, unknown>>) =>
        Promise.resolve({
          id: 'b1',
          ...input,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      ),
    findById: jest.fn().mockResolvedValue(null),
    findAllByUser: jest.fn().mockResolvedValue([]),
    update: jest
      .fn()
      .mockImplementation(
        (id: string, data: Partial<Record<string, unknown>>) =>
          Promise.resolve({
            id,
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
          }),
      ),
    softDelete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const makePrismaMock = (overrides: Partial<any> = {}) => {
  return {
    category: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'c1',
        user_id: 'u1',
        type: 'EXPENSE',
        is_active: true,
        is_system: false,
        deleted_at: null,
      }),
    },
    ...overrides,
  } as unknown as PrismaService;
};

const makeAuditMock = () =>
  ({
    record: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditLogService;

const makeSettingsMock = () =>
  ({
    getSettings: jest.fn().mockResolvedValue({ currency: 'IDR' }),
  }) as unknown as UserSettingsService;

describe('BudgetsService', () => {
  it('creates budget successfully and preserves BigInt', async () => {
    const repo = makeRepoMock();
    const prisma = makePrismaMock();
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    const input = {
      category_id: 'c1',
      budget_amount_cents: 5000,
      month: 8,
      year: 2026,
    };
    const created = await svc.create('u1', input);

    expect(repo.findByUserAndCategoryAndPeriod).toHaveBeenCalledWith(
      'u1',
      'c1',
      8,
      2026,
      // currency now always resolves (settings fallback -> 'IDR')
      'IDR',
    );
    expect(repo.create).toHaveBeenCalled();
    expect(created.budget_amount_cents).toEqual(BigInt(5000));
    // response is BudgetEntity (from repo.map), ensure id present
    expect(created.id).toBeDefined();
  });

  it('stores and updates budget currency when provided', async () => {
    const repo = makeRepoMock({
      findById: jest.fn().mockResolvedValue({
        id: 'b1',
        user_id: 'u1',
        category_id: 'c1',
        currency: 'SGD',
        budget_amount_cents: BigInt(5000),
        month: 9,
        year: 2026,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }),
    });
    const prisma = makePrismaMock();
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await svc.create('u1', {
      category_id: 'c1',
      currency: 'SGD',
      budget_amount_cents: 5000,
      month: 9,
      year: 2026,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'SGD' }),
    );

    await svc.update('u1', 'b1', { currency: 'EUR' });
    expect(repo.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ currency: 'EUR' }),
    );
  });

  it('rejects non-existing category', async () => {
    const repo = makeRepoMock();
    const prisma = makePrismaMock({
      category: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    const payloadBad: CreateBudgetDto = {
      category_id: 'bad',
      budget_amount_cents: 1000,
      month: 8,
      year: 2026,
    };
    await expect(svc.create('u1', payloadBad)).rejects.toBeDefined();
  });

  it('rejects category belonging to another user', async () => {
    const repo = makeRepoMock();
    const prisma = makePrismaMock({
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          user_id: 'u2',
          type: 'EXPENSE',
          is_active: true,
          is_system: false,
          deleted_at: null,
        }),
      },
    });
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await expect(
      svc.create('u1', {
        category_id: 'c1',
        budget_amount_cents: 1000,
        month: 8,
        year: 2026,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects INCOME category', async () => {
    const repo = makeRepoMock();
    const prisma = makePrismaMock({
      category: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          user_id: 'u1',
          type: 'INCOME',
          is_active: true,
          is_system: false,
          deleted_at: null,
        }),
      },
    });
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await expect(
      svc.create('u1', {
        category_id: 'c1',
        budget_amount_cents: 1000,
        month: 8,
        year: 2026,
      }),
    ).rejects.toBeDefined();
  });

  it('rejects duplicate budget for same user/category/month/year', async () => {
    const existing = {
      id: 'bExisting',
      user_id: 'u1',
      category_id: 'c1',
      budget_amount_cents: BigInt(1000),
      month: 8,
      year: 2026,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    const repo = makeRepoMock({
      findByUserAndCategoryAndPeriod: jest.fn().mockResolvedValue(existing),
    });
    const prisma = makePrismaMock();
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await expect(
      svc.create('u1', {
        category_id: 'c1',
        budget_amount_cents: 1000,
        month: 8,
        year: 2026,
      }),
    ).rejects.toBeDefined();
  });

  it('getById enforces ownership and not found for others', async () => {
    const rec = {
      id: 'b1',
      user_id: 'u2',
      category_id: 'c1',
      budget_amount_cents: BigInt(1000),
      month: 8,
      year: 2026,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    const repo = makeRepoMock({ findById: jest.fn().mockResolvedValue(rec) });
    const prisma = makePrismaMock();
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await expect(svc.getById('u1', 'b1')).rejects.toBeDefined();
  });

  it('softDelete sets deleted_at via repository', async () => {
    const rec = {
      id: 'b1',
      user_id: 'u1',
      category_id: 'c1',
      budget_amount_cents: BigInt(1000),
      month: 8,
      year: 2026,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    };
    const repo = makeRepoMock({
      findById: jest.fn().mockResolvedValue(rec),
      softDelete: jest.fn().mockResolvedValue(undefined),
    });
    const prisma = makePrismaMock();
    const audit = makeAuditMock();
    const svc = new BudgetsService(
      repo as unknown as PrismaBudgetsRepository,
      audit,
      prisma,
      makeSettingsMock(),
    );

    await svc.softDelete('u1', 'b1');
    expect(repo.softDelete).toHaveBeenCalledWith('b1');
  });
});
