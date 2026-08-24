import { SavingGoalsService } from './saving-goals.service';
import { PrismaSavingGoalsRepository } from '../repositories/prisma-saving-goals.repository';
import { UserSettingsService } from '../../settings/services/user-settings.service';
import { AuditLogService } from '../../audit-logs/services/audit-log.service';
import type { PrismaService } from '../../../database/prisma.service';
import { SavingGoalEntity } from '../entities/saving-goal.entity';

const makeGoal = (
  id: string,
  overrides: Partial<SavingGoalEntity> = {},
): SavingGoalEntity => ({
  id,
  user_id: 'u1',
  account_id: null,
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
  it('does not double-scale USD saving goal contributions', async () => {
    const repoMock: Partial<PrismaSavingGoalsRepository> & {
      findAllByUser: jest.Mock;
    } = {
      findAllByUser: jest.fn().mockResolvedValue([
        // two goals tied to the same USD account
        makeGoal('g1', {
          account_id: 'a_usd',
          target_amount_cents: BigInt(100000), // $1,000.00 -> 100000 cents
          current_amount_cents: BigInt(25000), // $250.00 -> 25000 cents
        }),
      ]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const prismaMock: Partial<PrismaService> = {
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'a_usd', currency: 'USD' }]),
      } as unknown as PrismaService['account'],
      // other methods are unused here
    };

    const svc = new SavingGoalsService(
      repoMock as unknown as PrismaSavingGoalsRepository,
      { record: jest.fn() } as unknown as AuditLogService,
      prismaMock as PrismaService,
      { getSettings: jest.fn().mockResolvedValue({ currency: 'IDR' }) } as unknown as UserSettingsService,
    );

    const overview = await svc.overview('u1');

    expect(overview.currency).toBe('USD');
    // primary target / current are returned as minor-unit strings
    expect(overview.targetAmount).toBe('100000');
    expect(overview.currentAmount).toBe('25000');
    expect(overview.percentageUsed).toBe(25);
  });

  it('aggregates multiple contributions by currency and preserves BigInt sums', async () => {
    const repoMock: Partial<PrismaSavingGoalsRepository> & {
      findAllByUser: jest.Mock;
    } = {
      findAllByUser: jest.fn().mockResolvedValue([
        // IDR goal (account null -> default IDR)
        makeGoal('g1', {
          account_id: null,
          target_amount_cents: BigInt(1000000),
          current_amount_cents: BigInt(500000),
        }),
        // USD goal tied to account
        makeGoal('g2', {
          account_id: 'a_usd',
          target_amount_cents: BigInt(100000),
          current_amount_cents: BigInt(25000),
        }),
      ]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const prismaMock: Partial<PrismaService> = {
      account: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'a_usd', currency: 'USD' }]),
      } as unknown as PrismaService['account'],
    };

    const svc = new SavingGoalsService(
      repoMock as unknown as PrismaSavingGoalsRepository,
      { record: jest.fn() } as unknown as AuditLogService,
      prismaMock as PrismaService,
      { getSettings: jest.fn().mockResolvedValue({ currency: 'IDR' }) } as unknown as UserSettingsService,
    );

    const overview = await svc.overview('u1');

    // total goals and counts
    expect(overview.total).toBe(2);
    expect(overview.active).toBe(2);

    // primary currency is the first encountered in the map (g1 -> IDR)
    expect(['IDR', 'USD']).toContain(overview.currency);

    // by_currency should contain both IDR and USD entries
    interface CurrencyOverviewRow {
      currency: string;
      targetAmount: string;
      currentAmount: string;
    }
    const found = (overview.by_currency as CurrencyOverviewRow[]).reduce(
      (acc: Record<string, CurrencyOverviewRow>, cur) => {
        acc[cur.currency] = cur;
        return acc;
      },
      {} as Record<string, CurrencyOverviewRow>,
    );

    expect(found['IDR']).toBeDefined();
    expect(found['USD']).toBeDefined();

    expect(found['IDR'].targetAmount).toBe('1000000');
    expect(found['IDR'].currentAmount).toBe('500000');

    expect(found['USD'].targetAmount).toBe('100000');
    expect(found['USD'].currentAmount).toBe('25000');
  });
});
