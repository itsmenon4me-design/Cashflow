import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { Server } from 'net';
import request from 'supertest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../services/notifications.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('NotificationsController (security)', () => {
  let app: INestApplication;
  let notificationsServiceMock: jest.Mocked<NotificationsService>;

  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<
          Request & { user?: { sub: string; role: string; email: string } }
        >();
      if (authGuard.shouldAttachUser) {
        req.user = {
          sub: 'user-auth',
          role: 'USER',
          email: 'auth@example.com',
        };
      }
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    shouldAttachUser: true,
  };

  beforeEach(async () => {
    const notificationEntity = {
      id: '11111111-1111-4111-8111-111111111111',
      user_id: 'user-auth',
      type: 'SYSTEM',
      title: 'Welcome',
      message: 'Hello',
      is_read: false,
      read_at: null,
      metadata: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const listResult = {
      data: [notificationEntity],
      pagination: {
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };

    notificationsServiceMock = {
      list: jest.fn().mockResolvedValue(listResult),
      unreadCount: jest.fn().mockResolvedValue(1),
      markRead: jest.fn().mockResolvedValue(notificationEntity),
      markAllRead: jest.fn().mockResolvedValue(1),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('list: passes authenticated userId and ignores client-supplied userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/notifications')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(
      (notificationsServiceMock as unknown as { list: jest.Mock }).list,
    ).toHaveBeenCalled();
    const calledWithUserId = notificationsServiceMock.list.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('unread-count: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/notifications/unread-count')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(
      (notificationsServiceMock as unknown as { unreadCount: jest.Mock })
        .unreadCount,
    ).toHaveBeenCalled();
    const calledWithUserId =
      notificationsServiceMock.unreadCount.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('read-all: passes authenticated userId and ignores client-supplied userId', async () => {
    await request(app.getHttpServer() as Server)
      .patch('/notifications/read-all')
      .send({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(
      (notificationsServiceMock as unknown as { markAllRead: jest.Mock })
        .markAllRead,
    ).toHaveBeenCalled();
    const calledWithUserId =
      notificationsServiceMock.markAllRead.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('mark-read: passes authenticated userId and route id', async () => {
    await request(app.getHttpServer() as Server)
      .patch('/notifications/11111111-1111-4111-8111-111111111111/read')
      .send({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(
      (notificationsServiceMock as unknown as { markRead: jest.Mock }).markRead,
    ).toHaveBeenCalled();
    const [calledWithUserId, id] =
      notificationsServiceMock.markRead.mock.calls[0];
    expect(calledWithUserId).toBe('user-auth');
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('delete: passes authenticated userId and route id', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/notifications/11111111-1111-4111-8111-111111111111')
      .expect(200);

    expect(
      (notificationsServiceMock as unknown as { remove: jest.Mock }).remove,
    ).toHaveBeenCalled();
    const [calledWithUserId, id] =
      notificationsServiceMock.remove.mock.calls[0];
    expect(calledWithUserId).toBe('user-auth');
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
  });
});
