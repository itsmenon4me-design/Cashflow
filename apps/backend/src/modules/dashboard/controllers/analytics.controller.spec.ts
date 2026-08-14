import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { CashflowAnalyticsService } from '../services/cashflow-analytics.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('AnalyticsController (security)', () => {
  let app: INestApplication;
  let analyticsServiceMock: { getAnalytics: jest.Mock };

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

  const analytics = {
    totalIncome: 0,
    totalExpense: 0,
    netCashFlow: 0,
  };

  beforeEach(async () => {
    analyticsServiceMock = {
      getAnalytics: jest.fn().mockResolvedValue(analytics),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: CashflowAnalyticsService, useValue: analyticsServiceMock },
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
    authGuard.isAuthenticated = true;
  });

  it('getAnalytics: passes authenticated userId and ignores attacker-supplied userId', async () => {
    const query = {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    };
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/dashboard/analytics')
      .query(query)
      .expect(200);

    expect(analyticsServiceMock.getAnalytics).toHaveBeenCalled();
    const [userId, start, end] = analyticsServiceMock.getAnalytics.mock
      .calls[0] as [string, Date, Date];
    expect(userId).toBe('user-auth');
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it('getAnalytics: identity comes from AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/dashboard/analytics')
      .expect(403);
    expect(analyticsServiceMock.getAnalytics).not.toHaveBeenCalled();
  });
});
