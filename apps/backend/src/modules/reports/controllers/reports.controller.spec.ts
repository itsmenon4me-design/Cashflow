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
import { ReportsController } from './reports.controller';
import { MonthlyReportService } from '../services/monthly-report.service';
import { CategoryBreakdownService } from '../services/category-breakdown.service';
import { CashflowTrendService } from '../services/cashflow-trend.service';
import { BudgetAnalyticsService } from '../services/budget-analytics.service';
import { ReportExportService } from '../services/report-export.service';
import { FinancialInsightsService } from '../services/financial-insights.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

type ReportsServiceMocks = {
  getMonthlyReport: jest.MockedFunction<
    MonthlyReportService['getMonthlyReport']
  >;
  getBreakdown: jest.MockedFunction<CategoryBreakdownService['getBreakdown']>;
  getTrend: jest.MockedFunction<CashflowTrendService['getTrend']>;
  analyzeMonth: jest.MockedFunction<BudgetAnalyticsService['analyzeMonth']>;
  export: jest.MockedFunction<ReportExportService['export']>;
  getInsights: jest.MockedFunction<FinancialInsightsService['getInsights']>;
};

describe('ReportsController (security)', () => {
  let app: INestApplication;
  let mocks: ReportsServiceMocks;

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
    mocks = {
      getMonthlyReport: jest.fn().mockResolvedValue({ report: [] }),
      getBreakdown: jest.fn().mockResolvedValue({ items: [] }),
      getTrend: jest.fn().mockResolvedValue({ points: [] }),
      analyzeMonth: jest.fn().mockResolvedValue({ analysis: {} }),
      export: jest.fn().mockResolvedValue({
        filename: 'report.json',
        contentType: 'application/json',
        content: '{}',
      }),
      getInsights: jest.fn().mockResolvedValue({ insights: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: MonthlyReportService,
          useValue: { getMonthlyReport: mocks.getMonthlyReport },
        },
        {
          provide: CategoryBreakdownService,
          useValue: { getBreakdown: mocks.getBreakdown },
        },
        {
          provide: CashflowTrendService,
          useValue: { getTrend: mocks.getTrend },
        },
        {
          provide: BudgetAnalyticsService,
          useValue: { analyzeMonth: mocks.analyzeMonth },
        },
        { provide: ReportExportService, useValue: { export: mocks.export } },
        {
          provide: FinancialInsightsService,
          useValue: { getInsights: mocks.getInsights },
        },
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

  it('monthly: passes authenticated userId and ignores client-supplied userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/reports/monthly?month=6&year=2026')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.getMonthlyReport).toHaveBeenCalled();
    const calledWithUserId = mocks.getMonthlyReport.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('category-breakdown: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/reports/category-breakdown?type=expense&month=6&year=2026')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.getBreakdown).toHaveBeenCalled();
    const calledWithUserId = mocks.getBreakdown.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('cashflow-trend: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Server)
      .get(
        '/reports/cashflow-trend?type=monthly&startDate=2026-01-01&endDate=2026-01-31',
      )
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.getTrend).toHaveBeenCalled();
    const calledWithUserId = mocks.getTrend.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('budget-analysis: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/reports/budget-analysis?month=6&year=2026')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.analyzeMonth).toHaveBeenCalled();
    const calledWithUserId = mocks.analyzeMonth.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('export: passes authenticated userId in export options', async () => {
    await request(app.getHttpServer() as Server)
      .get('/reports/export?type=monthly&format=json')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.export).toHaveBeenCalled();
    const exportOpts = mocks.export.mock.calls[0][0];
    expect(exportOpts.userId).toBe('user-auth');
  });

  it('financial-insights: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Server)
      .get('/reports/financial-insights')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.getInsights).toHaveBeenCalled();
    const calledWithUserId = mocks.getInsights.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
