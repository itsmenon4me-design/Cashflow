import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SessionsController } from './sessions.controller';
import { SessionService } from '../services/session.service';
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('SessionsController (security)', () => {
  let app: INestApplication;
  let sessionsServiceMock: any;

  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      if (authGuard.shouldAttachUser) {
        req.user = {
          sub: 'user-auth',
          role: 'USER',
          email: 'auth@example.com',
          sessionId: 'session-auth',
          jti: 'jti-auth',
        };
      }
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    shouldAttachUser: true,
  };

  beforeEach(async () => {
    const sessionEntity = {
      id: 'session-auth',
      user_id: 'user-auth',
      refresh_token_id: 'rt1',
      device_name: 'Chrome',
      device_type: 'desktop',
      browser: 'Chrome',
      operating_system: 'Windows',
      ip_address: '127.0.0.1',
      user_agent: 'ua',
      last_activity_at: new Date(),
      expires_at: new Date(),
      revoked_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    sessionsServiceMock = {
      listForUser: jest.fn().mockResolvedValue([sessionEntity]),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllExcept: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionService, useValue: sessionsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/auth/sessions').expect(200);

    expect(sessionsServiceMock.listForUser).toHaveBeenCalled();
    const calledWithUserId = sessionsServiceMock.listForUser.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('revoke: passes authenticated userId and route session id to service', async () => {
    await request(app.getHttpServer())
      .delete('/auth/sessions/session-target')
      .expect(200);

    expect(sessionsServiceMock.revoke).toHaveBeenCalled();
    const [sessionId, userId] = sessionsServiceMock.revoke.mock.calls[0];
    expect(sessionId).toBe('session-target');
    expect(userId).toBe('user-auth');
  });

  it('revoke: client-supplied userId cannot override authenticated identity', async () => {
    await request(app.getHttpServer())
      .delete('/auth/sessions/session-target')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(sessionsServiceMock.revoke).toHaveBeenCalled();
    const [, userId] = sessionsServiceMock.revoke.mock.calls[0];
    expect(userId).toBe('user-auth');
  });

  it('revoke-all: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).delete('/auth/sessions').expect(200);

    expect(sessionsServiceMock.revokeAllExcept).toHaveBeenCalled();
    const calledWithUserId =
      sessionsServiceMock.revokeAllExcept.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('revoke-all: client-supplied userId cannot override authenticated identity', async () => {
    await request(app.getHttpServer())
      .delete('/auth/sessions')
      .send({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(sessionsServiceMock.revokeAllExcept).toHaveBeenCalled();
    const calledWithUserId =
      sessionsServiceMock.revokeAllExcept.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('revoke-all: passes trusted sessionId claim to keep current session alive', async () => {
    await request(app.getHttpServer()).delete('/auth/sessions').expect(200);

    expect(sessionsServiceMock.revokeAllExcept).toHaveBeenCalled();
    const [, exceptSessionId] =
      sessionsServiceMock.revokeAllExcept.mock.calls[0];
    expect(exceptSessionId).toBe('session-auth');
  });

  it('revoke-all: ignores client-supplied sessionId', async () => {
    await request(app.getHttpServer())
      .delete('/auth/sessions')
      .send({ sessionId: 'session-attacker', jti: 'jti-attacker' })
      .expect(200);

    expect(sessionsServiceMock.revokeAllExcept).toHaveBeenCalled();
    const [, exceptSessionId] =
      sessionsServiceMock.revokeAllExcept.mock.calls[0];
    expect(exceptSessionId).toBe('session-auth');
  });
});
