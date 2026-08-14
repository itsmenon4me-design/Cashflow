import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from '../services/analytics.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('AnalyticsController (security)', () => {
  let app: INestApplication;
  let analyticsServiceMock: {
    overview: jest.Mock;
    income: jest.Mock;
    expenses: jest.Mock;
    cashflow: jest.Mock;
    spending: jest.Mock;
    financialHealth: jest.Mock;
    insights: jest.Mock;
  };

  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user?: { sub: string; role: string; email: string } }>();
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

  const ATTACKER_QUERY = { userId: 'user-attacker', user_id: 'user-attacker' };

  const firstArgOf = (mock: jest.Mock): string =>
    (mock.mock.calls[0] as unknown[])[0] as string;

  beforeEach(async () => {
    analyticsServiceMock = {
      overview: jest.fn().mockResolvedValue({}),
      income: jest.fn().mockResolvedValue({}),
      expenses: jest.fn().mockResolvedValue({}),
      cashflow: jest.fn().mockResolvedValue({}),
      spending: jest.fn().mockResolvedValue({}),
      financialHealth: jest.fn().mockResolvedValue({}),
      insights: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsServiceMock },
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

  const range = 'startDate=2026-01-01&endDate=2026-01-31';

  it('overview: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/overview?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.overview).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.overview)).toBe('user-auth');
  });

  it('income: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/income?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.income).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.income)).toBe('user-auth');
  });

  it('expenses: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/expenses?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.expenses).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.expenses)).toBe('user-auth');
  });

  it('cashflow: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/cashflow?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.cashflow).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.cashflow)).toBe('user-auth');
  });

  it('spending: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/spending?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.spending).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.spending)).toBe('user-auth');
  });

  it('financial-health: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/financial-health?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.financialHealth).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.financialHealth)).toBe('user-auth');
  });

  it('insights: passes authenticated userId, ignores attacker userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/analytics/insights?${range}`)
      .query(ATTACKER_QUERY)
      .expect(200);

    expect(analyticsServiceMock.insights).toHaveBeenCalled();
    expect(firstArgOf(analyticsServiceMock.insights)).toBe('user-auth');
  });
});
