import { Test, TestingModule } from '@nestjs/testing';
import { SavingGoalsService } from './saving-goals.service';
import { PrismaSavingGoalsRepository } from '../repositories/prisma-saving-goals.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import { PrismaService } from '../../../database/prisma.service';
import { SavingGoalEntity } from '../entities/saving-goal.entity';

const dummyGoal = (
  id: string,
  overrides: Partial<SavingGoalEntity> = {},
): SavingGoalEntity => ({
  id,
  user_id: 'u1',
  account_id: null,
  category_id: null,
  name: 'Emergency Fund',
  description: null,
  target_amount_cents: BigInt(1000000),
  current_amount_cents: BigInt(250000),
  start_date: new Date('2026-01-01'),
  target_date: new Date('2026-12-31'),
  status: 'ACTIVE',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('SavingGoalsService', () => {
  let service: SavingGoalsService;
  let repoMock: Partial<PrismaSavingGoalsRepository> & {
    findById: jest.Mock;
    findAllByUser: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(async () => {
    repoMock = {
      findById: jest.fn().mockResolvedValue(dummyGoal('g1')),
      findAllByUser: jest
        .fn()
        .mockResolvedValue([dummyGoal('g1'), dummyGoal('g2')]),
      create: jest.fn().mockResolvedValue(dummyGoal('g1')),
      update: jest.fn().mockResolvedValue(dummyGoal('g1')),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const prismaMock = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      category: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingGoalsService,
        { provide: PrismaSavingGoalsRepository, useValue: repoMock },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SavingGoalsService>(SavingGoalsService);
  });

  it('lists goals for user', async () => {
    const items = await service.listAll('u1');
    expect(items).toHaveLength(2);
    expect(repoMock.findAllByUser).toHaveBeenCalledWith('u1');
  });

  it('denies access to a goal owned by another user', async () => {
    repoMock.findById.mockResolvedValue(
      dummyGoal('g1', { user_id: 'someone-else' }),
    );
    await expect(service.getById('u1', 'g1')).rejects.toThrow();
  });

  it('throws when target date is before start date', async () => {
    await expect(
      service.create('u1', {
        name: 'Goal',
        target_amount_cents: 100000,
        start_date: '2026-12-31',
        target_date: '2026-01-01',
      }),
    ).rejects.toThrow();
  });

  it('creates a goal with valid payload', async () => {
    repoMock.create.mockResolvedValue(dummyGoal('g1'));
    const created = await service.create('u1', {
      name: 'Goal',
      target_amount_cents: 100000,
      current_amount_cents: 0,
      start_date: '2026-01-01',
      target_date: '2026-12-31',
      status: 'ACTIVE',
    });
    expect(created.id).toBe('g1');
    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Goal' }),
    );
  });

  it('computes overview totals', async () => {
    repoMock.findAllByUser.mockResolvedValue([
      dummyGoal('g1', {
        status: 'ACTIVE',
        target_amount_cents: BigInt(1000000),
        current_amount_cents: BigInt(250000),
      }),
      dummyGoal('g2', {
        status: 'COMPLETED',
        target_amount_cents: BigInt(500000),
        current_amount_cents: BigInt(500000),
      }),
    ]);
    const overview = await service.overview('u1');
    expect(overview.total).toBe(2);
    expect(overview.completed).toBe(1);
    expect(overview.targetAmount).toBe('1000000');
    expect(overview.percentageUsed).toBe(25);
  });
});
