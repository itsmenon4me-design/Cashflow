import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Server } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SpendingPredictionController } from './spending-prediction.controller';
import { SpendingPredictionService } from '../services/spending-prediction.service';
import { SpendingPredictionResponseDto } from '../dto/spending-prediction-response.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AppValidationPipe } from '../../../common/pipes/validation.pipe';

const dummyPrediction = (): SpendingPredictionResponseDto => ({
  currency: 'IDR',
  period: '2026-06',
  predictedTotalCents: '500000',
  confidence: 0.65,
  categories: [
    {
      categoryId: 'cat-food',
      categoryName: 'Food',
      predictedAmountCents: '300000',
      confidence: 0.75,
      basedOnMonths: 3,
    },
  ],
  noHistoryCategoryIds: [],
  otherCents: '200000',
  insufficientData: false,
});

describe('SpendingPredictionController', () => {
  let app: INestApplication;
  let predictionServiceMock: { predict: jest.Mock };
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
    predictionServiceMock = {
      predict: jest.fn().mockResolvedValue(dummyPrediction()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpendingPredictionController],
      providers: [
        { provide: SpendingPredictionService, useValue: predictionServiceMock },
      ],
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
      .get('/ai/spending-prediction')
      .expect(403);
  });

  it('passes req.user.sub to the prediction service', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(200);

    const body = response.body as { success: boolean };
    expect(predictionServiceMock.predict).toHaveBeenCalledWith('u1', {
      horizon: 1,
    });
    expect(body.success).toBe(true);
  });

  it('uses the default horizon', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(200);

    expect(predictionServiceMock.predict).toHaveBeenCalledWith('u1', {
      horizon: 1,
    });
  });

  it('passes an explicit horizon to the service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction?horizon=6')
      .expect(200);

    expect(predictionServiceMock.predict).toHaveBeenCalledWith('u1', {
      horizon: 6,
    });
  });

  it('returns insufficientData as a successful HTTP 200', async () => {
    predictionServiceMock.predict.mockResolvedValueOnce({
      ...dummyPrediction(),
      predictedTotalCents: '0',
      confidence: 0,
      categories: [],
      insufficientData: true,
    });

    const response = await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { insufficientData: boolean; predictedTotalCents: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.insufficientData).toBe(true);
    expect(body.data.predictedTotalCents).toBe('0');
  });

  it('wraps the service response correctly', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: dummyPrediction(),
    });
  });

  it('rejects invalid query values', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction?horizon=7')
      .expect(400);
  });

  it('surfaces service failures through the exception pipeline', async () => {
    predictionServiceMock.predict.mockRejectedValueOnce(new Error('boom'));

    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(500);
  });

  it('rejects a client-supplied userId (production forbidNonWhitelisted contract)', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction?userId=attacker')
      .expect(400);

    expect(predictionServiceMock.predict).not.toHaveBeenCalled();
  });

  it('rejects a horizon below the minimum', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction?horizon=0')
      .expect(400);
  });

  it('rejects a non-integer horizon', async () => {
    await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction?horizon=2.5')
      .expect(400);
  });

  it('serializes only the documented contract shape with string money values', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/ai/spending-prediction')
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: {
        currency: string;
        period: string;
        predictedTotalCents: string;
        confidence: number;
        categories: Record<string, unknown>[];
        noHistoryCategoryIds: unknown[];
        otherCents: string;
        insufficientData: boolean;
      };
    };

    expect(Object.keys(body).sort()).toEqual(['data', 'success']);
    expect(body.success).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual([
      'categories',
      'confidence',
      'currency',
      'insufficientData',
      'noHistoryCategoryIds',
      'otherCents',
      'period',
      'predictedTotalCents',
    ]);
    expect(Object.keys(body.data.categories[0]).sort()).toEqual([
      'basedOnMonths',
      'categoryId',
      'categoryName',
      'confidence',
      'predictedAmountCents',
    ]);
    expect(body.data.predictedTotalCents).toMatch(/^\d+$/);
    expect(body.data.otherCents).toMatch(/^\d+$/);
    expect(
      (body.data.categories[0] as { predictedAmountCents: string })
        .predictedAmountCents,
    ).toMatch(/^\d+$/);
    expect(body.data).not.toHaveProperty('user_id');
    expect(body.data).not.toHaveProperty('transactions');
    expect(body.data).not.toHaveProperty('transfer_group_id');
  });
});
