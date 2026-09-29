import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { beforeAll } from '@jest/globals';
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
import { PrismaService } from '../../../database/prisma.service';

beforeAll(() => {
  console.log(
    `timezone-test TZ=${process.env.TZ}; offset=${new Date().getTimezoneOffset()}`,
  );
});

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
  let timezoneLookup: jest.Mock;

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
    timezoneLookup = jest
      .fn()
      .mockResolvedValue({ timezone: 'Asia/Jakarta' });
    mocks = {
      getMonthlyReport: jest.fn().mockResolvedValue({ report: [] }),
      getBreakdown: jest.fn().mockResolvedValue({ items: [] }),
      getTrend: jest.fn().mockResolvedValue({ points: [] }),
      analyzeMonth: jest.fn().mockResolvedValue({ analysis: {} }),
      export: jest.fn().mockResolvedValue({
        filename: 'report.csv',
        contentType: 'text/csv',
        content: 'a,b\n1,2',
      }),
      getInsights: jest.fn().mockResolvedValue({ insights: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            userSettings: {
              findUnique: timezoneLookup,
            },
          },
        },
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

  it('cashflow-trend: expands date-only inputs to full WIB days', async () => {
    await request(app.getHttpServer() as Server)
      .get(
        '/reports/cashflow-trend?type=daily&startDate=2026-08-31&endDate=2026-09-01',
      )
      .expect(200);

    const [userId, , start, end] = mocks.getTrend.mock.calls[0];
    expect(userId).toBe('user-auth');
    expect(start).toEqual(new Date('2026-08-30T17:00:00.000Z'));
    expect(end).toEqual(new Date('2026-09-01T16:59:59.999Z'));

    const transactions = [
      new Date('2026-09-01T03:00:00+07:00'),
      new Date('2026-08-31T23:59:00+07:00'),
    ];
    expect(transactions.every((date) => date >= start && date <= end)).toBe(
      true,
    );
    const endOfDate = new Date('2026-09-01T23:59:00+07:00');
    expect(endOfDate >= start && endOfDate <= end).toBe(true);
  });

  it.each([
    ['Asia/Jakarta', '2026-08-31T17:00:00.000Z', '2026-09-30T16:59:59.999Z'],
    ['Asia/Makassar', '2026-08-31T16:00:00.000Z', '2026-09-30T15:59:59.999Z'],
    ['Asia/Jayapura', '2026-08-31T15:00:00.000Z', '2026-09-30T14:59:59.999Z'],
  ])(
    'uses date-only month bounds in %s and preserves equivalent ISO instants',
    async (timeZone, startIso, endIso) => {
      timezoneLookup.mockResolvedValue({ timezone: timeZone });
      await request(app.getHttpServer() as Server)
        .get(
          '/reports/cashflow-trend?type=daily&startDate=2026-09-01&endDate=2026-09-30',
        )
        .expect(200);
      const first = mocks.getTrend.mock.calls[0];
      expect(first[2]).toEqual(new Date(startIso));
      expect(first[3]).toEqual(new Date(endIso));

      mocks.getTrend.mockClear();
      await request(app.getHttpServer() as Server)
        .get('/reports/cashflow-trend')
        .query({
          type: 'daily',
          startDate: startIso,
          endDate: endIso,
        })
        .expect(200);
      const second = mocks.getTrend.mock.calls[0];
      expect(second[2]).toEqual(first[2]);
      expect(second[3]).toEqual(first[3]);
    },
  );

  it('cashflow-trend: preserves ISO timestamp instants', async () => {
    const startDate = '2026-08-31T23:59:00+07:00';
    const endDate = '2026-09-01T03:00:00+07:00';
    await request(app.getHttpServer() as Server)
      .get('/reports/cashflow-trend')
      .query({ type: 'daily', startDate, endDate })
      .expect(200);

    const [, , start, end] = mocks.getTrend.mock.calls[0];
    expect(start).toEqual(new Date(startDate));
    expect(end).toEqual(new Date(endDate));
    expect(start.toISOString()).toBe('2026-08-31T16:59:00.000Z');
    expect(end.toISOString()).toBe('2026-08-31T20:00:00.000Z');
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
      .get('/reports/export?type=monthly&format=xlsx')
      .query({
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-31T23:59:59.999Z',
      })
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(mocks.export).toHaveBeenCalled();
    const exportOpts = mocks.export.mock.calls[0][0];
    expect(exportOpts.userId).toBe('user-auth');
    expect(exportOpts.format).toBe('xlsx');
    expect(exportOpts.startDate).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    expect(exportOpts.endDate).toEqual(new Date('2026-08-31T23:59:59.999Z'));
  });

  it('export: returns XLSX content as base64 for the browser download', async () => {
    const workbookBytes = Buffer.from('xlsx-binary');
    mocks.export.mockResolvedValueOnce({
      filename: 'report.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: workbookBytes,
    });
    const response = await request(app.getHttpServer() as Server)
      .get('/reports/export?type=monthly&format=xlsx')
      .query({ startDate: '2026-08-01', endDate: '2026-08-31' })
      .expect(200);

    expect(response.body.content).toBe(workbookBytes.toString('base64'));
    expect(response.body.contentEncoding).toBe('base64');
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
