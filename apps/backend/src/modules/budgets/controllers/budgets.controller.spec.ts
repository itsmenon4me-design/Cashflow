import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import type { Server } from 'net';
import request from 'supertest';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from '../services/budgets.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('BudgetsController (security)', () => {
  let app: INestApplication;
  let budgetsServiceMock: jest.Mocked<BudgetsService>;

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
    const budgetEntity = {
      id: 'b1',
      category_id: 'cat1',
      category_name: 'Food',
      budget_amount_cents: BigInt(50000),
      month: 6,
      year: 2026,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    budgetsServiceMock = {
      listAll: jest.fn().mockResolvedValue([budgetEntity]),
      getById: jest.fn().mockResolvedValue(budgetEntity),
      create: jest.fn().mockResolvedValue(budgetEntity),
      update: jest.fn().mockResolvedValue(budgetEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BudgetsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: budgetsServiceMock }],
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

  it('create: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = {
      category_id: 'cat1',
      budget_amount_cents: 50000,
      month: 6,
      year: 2026,
      userId: 'user-attacker',
      user_id: 'user-attacker',
    };
    await request(app.getHttpServer() as Server)
      .post('/budgets')
      .send(body)
      .expect(201);

    expect(
      (budgetsServiceMock as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    const calledWithUserId = budgetsServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = { budget_amount_cents: 60000, userId: 'user-attacker' };
    await request(app.getHttpServer() as Server)
      .patch('/budgets/b1')
      .send(body)
      .expect(200);

    expect(
      (budgetsServiceMock as unknown as { update: jest.Mock }).update,
    ).toHaveBeenCalled();
    const calledWithUserId = budgetsServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/budgets/b1')
      .expect(200);
    expect(
      (budgetsServiceMock as unknown as { getById: jest.Mock }).getById,
    ).toHaveBeenCalled();
    const calledWithUserId = budgetsServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('by-id access: rejects records owned by another user with 404', async () => {
    budgetsServiceMock.getById.mockRejectedValueOnce(
      new NotFoundException('Budget not found'),
    );
    await request(app.getHttpServer() as Server)
      .get('/budgets/other-user-budget')
      .expect(404);

    budgetsServiceMock.update.mockRejectedValueOnce(
      new NotFoundException('Budget not found'),
    );
    await request(app.getHttpServer() as Server)
      .patch('/budgets/other-user-budget')
      .send({ budget_amount_cents: 25000 })
      .expect(404);

    budgetsServiceMock.softDelete.mockRejectedValueOnce(
      new NotFoundException('Budget not found'),
    );
    await request(app.getHttpServer() as Server)
      .delete('/budgets/other-user-budget')
      .expect(404);
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/budgets/b1')
      .expect(200);
    expect(
      (budgetsServiceMock as unknown as { softDelete: jest.Mock }).softDelete,
    ).toHaveBeenCalled();
    const calledWithUserId = budgetsServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/budgets')
      .expect(200);
    expect(
      (budgetsServiceMock as unknown as { listAll: jest.Mock }).listAll,
    ).toHaveBeenCalled();
    const calledWithUserId = budgetsServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
