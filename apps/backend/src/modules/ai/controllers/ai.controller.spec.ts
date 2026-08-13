import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Server } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AiController } from './ai.controller';
import { AiService } from '../services/ai.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AppValidationPipe } from '../../../common/pipes/validation.pipe';

describe('AiController', () => {
  let app: INestApplication;
  let aiServiceMock: { suggestTransactionCategory: jest.Mock };
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
    aiServiceMock = {
      suggestTransactionCategory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiServiceMock }],
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
      .post('/ai/transactions/suggest-category')
      .send({ transaction_type: 'EXPENSE' })
      .expect(403);
    expect(aiServiceMock.suggestTransactionCategory).not.toHaveBeenCalled();
    authGuard.isAuthenticated = true;
  });

  it('rejects a client-supplied userId (production forbidNonWhitelisted contract)', async () => {
    await request(app.getHttpServer() as Server)
      .post('/ai/transactions/suggest-category')
      .send({
        description: 'Dinner',
        transaction_type: 'EXPENSE',
        userId: 'user-attacker',
        user_id: 'user-attacker',
        sub: 'user-attacker',
      })
      .expect(400);

    expect(aiServiceMock.suggestTransactionCategory).not.toHaveBeenCalled();
  });

  it('returns a suggestion for authenticated users', async () => {
    authGuard.isAuthenticated = true;
    authGuard.shouldAttachUser = true;
    aiServiceMock.suggestTransactionCategory.mockResolvedValueOnce({
      categoryId: 'c1',
      categoryName: 'Food',
      confidence: 0.8,
      reason: 'The provider suggests Food',
    });

    const response = await request(app.getHttpServer() as Server)
      .post('/ai/transactions/suggest-category')
      .send({
        description: 'Dinner',
        transaction_type: 'EXPENSE',
      })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: {
        categoryId: 'c1',
        categoryName: 'Food',
        confidence: 0.8,
        reason: 'The provider suggests Food',
      },
    });
    expect(aiServiceMock.suggestTransactionCategory).toHaveBeenCalledWith(
      'u1',
      {
        description: 'Dinner',
        transaction_type: 'EXPENSE',
      },
    );
  });
});
