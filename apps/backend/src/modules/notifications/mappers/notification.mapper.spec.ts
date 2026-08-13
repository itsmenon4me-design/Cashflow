import { describe, expect, it } from '@jest/globals';
import { toNotificationResponse } from './notification.mapper';

describe('toNotificationResponse', () => {
  it('strips internal dedupeKey from metadata', () => {
    const notification = {
      id: 'notification-1',
      user_id: 'user-1',
      type: 'BUDGET_THRESHOLD',
      title: 'Budget warning',
      message: 'Budget is approaching limit.',
      is_read: false,
      read_at: null,
      metadata: {
        ruleType: 'BUDGET_THRESHOLD',
        priority: 'MEDIUM',
        dedupeKey: 'user-1|BUDGET_THRESHOLD|budget-1|2026-08',
      },
      created_at: new Date('2026-08-09T11:00:00Z'),
      updated_at: new Date('2026-08-09T11:00:00Z'),
    };

    const response = toNotificationResponse(notification);

    expect(response.metadata).toEqual({
      ruleType: 'BUDGET_THRESHOLD',
      priority: 'MEDIUM',
    });
    const metadata = response.metadata as Record<string, unknown>;
    expect(metadata.dedupeKey).toBeUndefined();
  });
});
