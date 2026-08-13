import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SettingsController } from './settings.controller';
import { UserSettingsService } from '../services/user-settings.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('SettingsController (security)', () => {
  let app: INestApplication;
  let settingsServiceMock: any;

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
        };
      }
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    shouldAttachUser: true,
  };

  const settingsResponse = {
    success: true,
    data: {
      id: 'settings-1',
      user_id: 'user-auth',
      theme: 'dark',
      language: 'id',
      currency: 'IDR',
      timezone: null,
      notification_preferences: {
        system: true,
        budgets: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  beforeEach(async () => {
    settingsServiceMock = {
      getSettings: jest.fn().mockResolvedValue(settingsResponse.data),
      updateSettings: jest.fn().mockResolvedValue(settingsResponse.data),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: UserSettingsService, useValue: settingsServiceMock },
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

  it('get: passes authenticated userId and ignores client-supplied userId', async () => {
    const query = {
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    };
    await request(app.getHttpServer())
      .get('/settings')
      .query(query)
      .expect(200);

    expect(settingsServiceMock.getSettings).toHaveBeenCalled();
    const calledWithUserId = settingsServiceMock.getSettings.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = {
      theme: 'light',
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    } as any;
    await request(app.getHttpServer())
      .patch('/settings')
      .send(body)
      .expect(200);

    expect(settingsServiceMock.updateSettings).toHaveBeenCalled();
    const calledWithUserId =
      settingsServiceMock.updateSettings.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('get: identity comes from JWT/AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer()).get('/settings').expect(403);
    expect(settingsServiceMock.getSettings).not.toHaveBeenCalled();
    authGuard.isAuthenticated = true;
  });

  it('update: identity comes from JWT/AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer())
      .patch('/settings')
      .send({ theme: 'light' })
      .expect(403);
    expect(settingsServiceMock.updateSettings).not.toHaveBeenCalled();
    authGuard.isAuthenticated = true;
  });
});
