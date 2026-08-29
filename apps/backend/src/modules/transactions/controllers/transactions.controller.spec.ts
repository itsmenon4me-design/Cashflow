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
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from '../services/transactions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('TransactionsController (security)', () => {
  let app: INestApplication;
  let txServiceMock: jest.Mocked<TransactionsService>;

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
    const txEntity = {
      id: 't1',
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: BigInt(1000),
      transaction_date: new Date().toISOString(),
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    txServiceMock = {
      listAll: jest.fn().mockResolvedValue({
        data: [txEntity],
        pagination: {
          page: 1,
          limit: 20,
          totalItems: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      }),
      search: jest.fn().mockResolvedValue({
        data: [txEntity],
        pagination: {
          page: 1,
          limit: 20,
          totalItems: 1,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      }),
      getById: jest.fn().mockResolvedValue(txEntity),
      create: jest.fn().mockResolvedValue(txEntity),
      update: jest.fn().mockResolvedValue(txEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: txServiceMock }],
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

  it('create: passes authenticated userId to service and ignores client-supplied userId/user_id', async () => {
    const body = {
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: 1000,
      transaction_date: new Date().toISOString(),
      userId: 'user-attacker',
      user_id: 'user-attacker',
    };

    await request(app.getHttpServer() as Server)
      .post('/transactions')
      .send(body)
      .expect(201);

    expect(
      (txServiceMock as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('create: propagates request trace metadata from headers', async () => {
    const body = {
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: 1000,
      transaction_date: new Date().toISOString(),
    };

    await request(app.getHttpServer() as Server)
      .post('/transactions')
      .set('x-correlation-id', 'corr-trace-1')
      .set('x-request-id', 'req-trace-1')
      .send(body)
      .expect(201);

    expect(
      (txServiceMock as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    const trace = txServiceMock.create.mock.calls[0][2];
    expect(trace).toEqual({
      correlationId: 'corr-trace-1',
      requestId: 'req-trace-1',
    });
  });

  it('update: passes authenticated userId to service and ignores client-supplied userId', async () => {
    const body = { note: 'updated', userId: 'user-attacker' };
    await request(app.getHttpServer() as Server)
      .patch('/transactions/t1')
      .send(body)
      .expect(200);

    expect(
      (txServiceMock as unknown as { update: jest.Mock }).update,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/transactions/t1')
      .expect(200);
    expect(
      (txServiceMock as unknown as { getById: jest.Mock }).getById,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/transactions/t1')
      .expect(200);
    expect(
      (txServiceMock as unknown as { softDelete: jest.Mock }).softDelete,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/transactions')
      .expect(200);
    expect(
      (txServiceMock as unknown as { listAll: jest.Mock }).listAll,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('search: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/transactions/search?q=rent')
      .expect(200);
    expect(
      (txServiceMock as unknown as { search: jest.Mock }).search,
    ).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.search.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
