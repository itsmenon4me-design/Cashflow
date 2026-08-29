import { SavingGoalsService } from './saving-goals.service';
import { PrismaSavingGoalsRepository } from '../repositories/prisma-saving-goals.repository';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import type { PrismaService } from '../../../database/prisma.service';
import { SavingGoalEntity } from '../entities/saving-goal.entity';

const makeGoal = (
  id: string,
  overrides: Partial<SavingGoalEntity> = {},
): SavingGoalEntity => ({
  id,
  user_id: 'u1',
  category_id: null,
  name: 'Goal',
  description: null,
  target_amount_cents: BigInt(1000000),
  current_amount_cents: BigInt(0),
  start_date: new Date('2026-01-01'),
  target_date: new Date('2026-12-31'),
  status: 'ACTIVE',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('SavingGoalsService - regression money invariants', () => {
  it('aggregates all active goals in fixed IDR regardless of stored currency', async () => {
    const repoMock: Partial<PrismaSavingGoalsRepository> & {
      findAllByUser: jest.Mock;
    } = {
      findAllByUser: jest.fn().mockResolvedValue([
        makeGoal('g1', {
          currency: 'IDR',
                  target_amount_cents: BigInt(1000000),
          current_amount_cents: BigInt(500000),
        }),
        makeGoal('g2', {
          currency: 'USD',
          target_amount_cents: BigInt(100000),
          current_amount_cents: BigInt(25000),
        }),
      ]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const prismaMock: Partial<PrismaService> = {};

    const svc = new SavingGoalsService(
      repoMock as unknown as PrismaSavingGoalsRepository,
      { record: jest.fn() } as unknown as AuditLogService,
      prismaMock as PrismaService,
    );

    const overview = await svc.overview('u1');

    expect(overview.total).toBe(2);
    expect(overview.active).toBe(2);
    expect(overview.currency).toBe('IDR');
    expect(overview.targetAmount).toBe('1100000');
    expect(overview.currentAmount).toBe('525000');
  });
});
