import { describe, expect, it, jest } from '@jest/globals';
import type {
  NotificationCreateData,
  NotificationsRepository,
} from '../repositories/notifications.repository.interface';
import { NotificationEntity } from '../entities/notification.entity';
import { NotificationsService } from './notifications.service';

const makeMockRepository = () => {
  return {
    findByDedupeKey:
      jest.fn<
        (
          userId: string,
          dedupeKey: string,
        ) => Promise<NotificationEntity | null>
      >(),
    create:
      jest.fn<(input: NotificationCreateData) => Promise<NotificationEntity>>(),
  } satisfies Pick<NotificationsRepository, 'findByDedupeKey' | 'create'>;
};

describe('NotificationsService.createIfNotExists', () => {
  it('returns the same notification when concurrent create attempts race on dedupe key', async () => {
    const repository = makeMockRepository();
    const existingNotification = {
      id: 'notification-1',
      user_id: 'user-1',
      type: 'BUDGET_THRESHOLD',
      title: 'Budget warning',
      message: 'Budget approaching limit',
      is_read: false,
      read_at: null,
      metadata: {
        ruleType: 'BUDGET_THRESHOLD',
        priority: 'MEDIUM',
      },
      created_at: new Date('2026-08-09T11:00:00Z'),
      updated_at: new Date('2026-08-09T11:00:00Z'),
    };

    repository.findByDedupeKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingNotification);

    repository.create
      .mockResolvedValueOnce(existingNotification)
      .mockImplementationOnce(async () => {
        const error: any = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      });

    const service = new NotificationsService(repository as any);

    const results = await Promise.all([
      service.createIfNotExists(
        'user-1',
        'BUDGET_THRESHOLD',
        'Budget warning',
        'Budget approaching limit',
        { ruleType: 'BUDGET_THRESHOLD', priority: 'MEDIUM' },
        'user-1|BUDGET_THRESHOLD|category-1|2026-08',
      ),
      service.createIfNotExists(
        'user-1',
        'BUDGET_THRESHOLD',
        'Budget warning',
        'Budget approaching limit',
        { ruleType: 'BUDGET_THRESHOLD', priority: 'MEDIUM' },
        'user-1|BUDGET_THRESHOLD|category-1|2026-08',
      ),
    ]);

    expect(results[0]).toBe(existingNotification);
    expect(results[1]).toBe(existingNotification);
    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(repository.findByDedupeKey).toHaveBeenCalledTimes(3);
  });
});
