import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/axios';
import { notificationService } from '@/services/notification.service';

describe('notificationService.list', () => {
  it('accepts the backend payload shape where data contains items and pagination', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0, hasNext: false, hasPrevious: false },
      },
    } as never);

    await expect(notificationService.list({ page: 1, limit: 20 })).resolves.toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    });
  });

  it('accepts the legacy payload shape where data is an array', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'n-1',
          user_id: 'u-1',
          type: 'SYSTEM',
          title: 'System notice',
          message: 'Everything is fine',
          is_read: false,
          read_at: null,
          metadata: null,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1, hasNext: false, hasPrevious: false },
    } as never);

    await expect(notificationService.list({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          id: 'n-1',
          title: 'System notice',
          isRead: false,
        }),
      ],
      pagination: expect.objectContaining({ totalItems: 1 }),
    });
  });
});
