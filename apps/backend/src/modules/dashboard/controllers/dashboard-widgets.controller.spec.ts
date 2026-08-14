import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DashboardWidgetsController } from './dashboard-widgets.controller';
import { DashboardWidgetsService } from '../services/dashboard-widgets.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('DashboardWidgetsController (security)', () => {
  let app: INestApplication;
  let widgetsServiceMock: { getWidgets: jest.Mock };

  const authGuard: CanActivate & { isAuthenticated: boolean } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user: { sub: string; role: string; email: string } }>();
      req.user = { sub: 'user-auth', role: 'USER', email: 'auth@example.com' };
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
  };

  const widgets = {
    summary: {},
    cashFlow: {},
    monthlyReport: {},
    categoryBreakdown: [],
    trend: [],
    budget: {},
  };

  beforeEach(async () => {
    widgetsServiceMock = {
      getWidgets: jest.fn().mockResolvedValue(widgets),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardWidgetsController],
      providers: [
        { provide: DashboardWidgetsService, useValue: widgetsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    authGuard.isAuthenticated = true;
  });

  it('getWidgets: passes authenticated userId and ignores attacker-supplied userId', async () => {
    const query = {
      month: '8',
      year: '2026',
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    };
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/dashboard/widgets')
      .query(query)
      .expect(200);

    expect(widgetsServiceMock.getWidgets).toHaveBeenCalled();
    const [userId, month, year] = widgetsServiceMock.getWidgets.mock
      .calls[0] as [string, number, number];
    expect(userId).toBe('user-auth');
    expect(month).toBe(8);
    expect(year).toBe(2026);
  });

  it('getWidgets: identity comes from AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/dashboard/widgets')
      .expect(403);
    expect(widgetsServiceMock.getWidgets).not.toHaveBeenCalled();
  });
});
