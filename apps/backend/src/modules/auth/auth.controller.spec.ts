import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { UsersService } from '../users/services/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RedisService } from '../../redis/redis.service';
import { AuthConfigService } from '../../config/auth-config.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('AuthController', () => {
  let controller: AuthController;
  let app: INestApplication;
  const mockAuthService = {};
  const mockSessionService = { logoutCurrent: jest.fn() };
  const mockUsersService = { create: jest.fn(), findById: jest.fn() };
  const mockRedisService = { incr: jest.fn().mockResolvedValue(1) };
  const mockAuthConfigService = {
    config: {
      loginLimit: 5,
      loginWindowSeconds: 60,
      registerLimit: 10,
      registerWindowSeconds: 60,
      refreshLimit: 30,
      refreshWindowSeconds: 60,
      failLimit: 10,
      failWindowSeconds: 3600,
    },
  };
  const mockLoggerService = { securityLog: jest.fn() };

  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{
        user?: {
          sub: string;
          role: string;
          email: string;
          sessionId: string;
          jti: string;
        };
      }>();
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

  const userEntity = {
    id: 'user-auth',
    email: 'auth@example.com',
    username: 'authuser',
    full_name: 'Auth User',
    avatar_url: null,
    phone_number: null,
    status: 'ACTIVE',
    email_verified_at: null,
    last_login_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    password_hash: 'hidden',
  };

  beforeEach(async () => {
    mockSessionService.logoutCurrent.mockClear();
    mockUsersService.create.mockClear();
    mockUsersService.findById.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuthConfigService, useValue: mockAuthConfigService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('register delegates to UsersService and returns safe response', async () => {
    const dto: CreateUserDto = {
      email: 'reg@example.com',
      username: 'reguser',
      full_name: 'Reg User',
      password: 'VeryS3cureP@ss!',
    };

    const created = {
      id: 'u1',
      email: dto.email,
      username: dto.username,
      full_name: dto.full_name,
      password_hash: 'hidden',
      created_at: new Date(),
      updated_at: new Date(),
      status: 'PENDING_VERIFICATION',
    };

    mockUsersService.create.mockResolvedValue(created);

    const res = await controller.register(dto);

    expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    expect(res.success).toBe(true);
    expect(
      (res.data as unknown as { password_hash?: unknown }).password_hash,
    ).toBeUndefined();
    expect(res.data.email).toBe(dto.email);
  });

  it('me returns current user when found', async () => {
    mockUsersService.findById.mockResolvedValue(userEntity);

    const res = await controller.me('user-auth');

    expect(mockUsersService.findById).toHaveBeenCalledWith('user-auth');
    expect(res.success).toBe(true);
    expect(
      (res.data as unknown as { password_hash?: unknown }).password_hash,
    ).toBeUndefined();
    expect(res.data.email).toBe(userEntity.email);
  });

  it('me throws unauthorized when user not found', async () => {
    mockUsersService.findById.mockResolvedValue(null);
    await expect(controller.me('user-notfound')).rejects.toBeDefined();
  });

  it('me: passes authenticated userId from JWT', async () => {
    mockUsersService.findById.mockResolvedValue(userEntity);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/me')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mockUsersService.findById).toHaveBeenCalled();
    const findUserId = (
      mockUsersService.findById.mock.calls[0] as unknown[]
    )[0] as string;
    expect(findUserId).toBe('user-auth');
  });

  it('me: attacker query userId cannot override authenticated identity', async () => {
    mockUsersService.findById.mockResolvedValue(userEntity);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/auth/me')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    const findUserId = (
      mockUsersService.findById.mock.calls[0] as unknown[]
    )[0] as string;
    expect(findUserId).toBe('user-auth');
  });

  it('me: preserves response shape', async () => {
    mockUsersService.findById.mockResolvedValue(userEntity);
    const res = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/auth/me')
      .expect(200);

    const body = res.body as {
      success: boolean;
      message: string;
      data: { id: string };
    };
    expect(body.success).toBe(true);
    expect(body.message).toBe('User profile retrieved successfully');
    expect(body.data.id).toBe('user-auth');
    expect(body.data).not.toHaveProperty('password_hash');
  });

  it('logout: passes authenticated userId and sessionId to service', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .delete('/auth/logout')
      .expect(200);

    expect(mockSessionService.logoutCurrent).toHaveBeenCalled();
    const [sessionId, userId] = mockSessionService.logoutCurrent.mock
      .calls[0] as [string, string];
    expect(sessionId).toBe('session-auth');
    expect(userId).toBe('user-auth');
  });

  it('logout: attacker body cannot override authenticated identity', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .delete('/auth/logout')
      .send({
        userId: 'user-attacker',
        user_id: 'user-attacker',
        sessionId: 'session-attacker',
        jti: 'jti-attacker',
      })
      .expect(200);

    expect(mockSessionService.logoutCurrent).toHaveBeenCalled();
    const [sessionId, userId] = mockSessionService.logoutCurrent.mock
      .calls[0] as [string, string];
    expect(sessionId).toBe('session-auth');
    expect(userId).toBe('user-auth');
  });
});
