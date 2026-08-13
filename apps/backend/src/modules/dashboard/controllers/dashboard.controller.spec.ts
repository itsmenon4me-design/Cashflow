import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('DashboardController (security)', () => {
  let app: INestApplication;
  let dashboardServiceMock: any;

  const authGuard: CanActivate & { isAuthenticated: boolean } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-auth', role: 'USER', email: 'auth@example.com' };
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
  };

  const summary = {
    total_assets_cents: '100000',
    total_income_cents: '50000',
    total_expense_cents: '30000',
    net_cash_flow_cents: '20000',
    total_accounts: 2,
    total_categories: 5,
    total_transactions: 10,
    last_updated_at: null,
  };

  beforeEach(async () => {
    dashboardServiceMock = {
      getSummaryForUser: jest.fn().mockResolvedValue(summary),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
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

  it('getSummary: passes authenticated userId and ignores attacker-supplied userId', async () => {
    const query = {
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    };
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .query(query)
      .expect(200);

    expect(dashboardServiceMock.getSummaryForUser).toHaveBeenCalledWith(
      'user-auth',
    );
  });

  it('getSummary: identity comes from AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer()).get('/dashboard/summary').expect(403);
    expect(dashboardServiceMock.getSummaryForUser).not.toHaveBeenCalled();
  });
});
