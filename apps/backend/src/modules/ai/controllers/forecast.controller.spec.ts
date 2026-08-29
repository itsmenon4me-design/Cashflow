import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Server } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ForecastController } from './forecast.controller';
import { ForecastService } from '../services/forecast.service';
import { ForecastResponseDto } from '../dto/forecast-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AppValidationPipe } from '../../../common/pipes/validation.pipe';

const dummyForecast = (): ForecastResponseDto => ({
  currency: 'IDR',
  horizon: 3,
  months: [
    {
      period: '2026-06',
      projectedIncomeCents: '2000000',
      projectedExpenseCents: '1000000',
      projectedNetCashflowCents: '1000000',
      projectedEndingBalanceCents: '1100000',
    },
  ],
  confidence: 0.65,
  basis: {
    monthsUsed: 3,
    historyStart: '2026-02',
    historyEnd: '2026-04',
    totalIncomeCents: '6000000',
    totalExpenseCents: '3000000',
    averageMonthlyIncomeCents: '2000000',
    averageMonthlyExpenseCents: '1000000',
  },
  outliers: [],
  insufficientData: false,
});

describe('ForecastController', () => {
  let app: INestApplication;
  let forecastServiceMock: { forecast: jest.Mock };
  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<Request & { user?: { sub?: string } }>();
      if (authGuard.shouldAttachUser) {
        req.user = { sub: 'u1' };
      }
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    shouldAttachUser: true,
  };

  beforeEach(async () => {
    authGuard.isAuthenticated = true;
    authGuard.shouldAttachUser = true;
    forecastServiceMock = {
      forecast: jest.fn().mockResolvedValue(dummyForecast()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [{ provide: ForecastService, useValue: forecastServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(403);
  });

  it('passes req.user.sub to the forecast service', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(200);

    const body = response.body as { success: boolean };
    expect(forecastServiceMock.forecast).toHaveBeenCalledWith('u1', {
      horizon: 3,
      startDate: undefined,
      endDate: undefined,
    });
    expect(body.success).toBe(true);
  });

  it('passes the default horizon to the service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(200);

    expect(forecastServiceMock.forecast).toHaveBeenCalledWith('u1', {
      horizon: 3,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('passes an explicit horizon to the service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?horizon=2')
      .expect(200);

    expect(forecastServiceMock.forecast).toHaveBeenCalledWith('u1', {
      horizon: 2,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('forwards startDate and endDate to the service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?startDate=2026-01-01&endDate=2026-04-30')
      .expect(200);

    expect(forecastServiceMock.forecast).toHaveBeenCalledWith('u1', {
      horizon: 3,
      startDate: '2026-01-01',
      endDate: '2026-04-30',
    });
  });

  it('returns insufficientData as a successful HTTP 200', async () => {
    forecastServiceMock.forecast.mockResolvedValueOnce({
      ...dummyForecast(),
      months: [],
      confidence: 0,
      insufficientData: true,
    });

    const response = await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { insufficientData: boolean; months: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.insufficientData).toBe(true);
    expect(body.data.months).toEqual([]);
  });

  it('wraps the service response correctly', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: dummyForecast(),
    });
  });

  it('rejects invalid query values', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?horizon=0')
      .expect(400);
  });

  it('surfaces service failures through the exception pipeline', async () => {
    forecastServiceMock.forecast.mockRejectedValueOnce(new Error('boom'));

    await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(500);
  });

  it('rejects a client-supplied userId (production forbidNonWhitelisted contract)', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?userId=attacker')
      .expect(400);

    expect(forecastServiceMock.forecast).not.toHaveBeenCalled();
  });

  it('rejects a non-integer horizon', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?horizon=2.5')
      .expect(400);
  });

  it('rejects a horizon above the maximum', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?horizon=7')
      .expect(400);
  });

  it('rejects an invalid startDate', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?startDate=not-a-date')
      .expect(400);
  });

  it('rejects an invalid endDate', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/forecast?endDate=not-a-date')
      .expect(400);
  });

  it('serializes only the documented contract shape with string money values', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/forecast')
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: {
        horizon: number;
        months: Record<string, unknown>[];
        basis: Record<string, unknown>;
        confidence: number;
        outliers: unknown[];
        insufficientData: boolean;
      };
    };

    expect(Object.keys(body).sort()).toEqual(['data', 'success']);
    expect(body.success).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual([
      'basis',
      'confidence',
      'currency',
      'horizon',
      'insufficientData',
      'months',
      'outliers',
    ]);
    expect(Object.keys(body.data.months[0]).sort()).toEqual([
      'period',
      'projectedEndingBalanceCents',
      'projectedExpenseCents',
      'projectedIncomeCents',
      'projectedNetCashflowCents',
    ]);
    expect(Object.keys(body.data.basis).sort()).toEqual([
      'averageMonthlyExpenseCents',
      'averageMonthlyIncomeCents',
      'historyEnd',
      'historyStart',
      'monthsUsed',
      'totalExpenseCents',
      'totalIncomeCents',
    ]);
    const month = body.data.months[0] as Record<string, string>;
    expect(month.projectedIncomeCents).toMatch(/^\d+$/);
    expect(month.projectedExpenseCents).toMatch(/^\d+$/);
    expect(month.projectedNetCashflowCents).toMatch(/^-?\d+$/);
    expect(month.projectedEndingBalanceCents).toMatch(/^-?\d+$/);
    expect(body.data).not.toHaveProperty('user_id');
    expect(body.data).not.toHaveProperty('transactions');
    expect(body.data).not.toHaveProperty('transfer_group_id');
  });
});
