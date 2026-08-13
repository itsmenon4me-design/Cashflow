import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from '../services/transactions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('TransactionsController (security)', () => {
  let app: INestApplication;
  let txServiceMock: any;

  const authGuard: CanActivate & {
    isAuthenticated: boolean;
    shouldAttachUser: boolean;
  } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
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
      account_id: 'acc1',
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: BigInt(1000),
      transaction_date: new Date().toISOString(),
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

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
    };

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
      account_id: 'acc1',
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: 1000,
      transaction_date: new Date().toISOString(),
      userId: 'user-attacker',
      user_id: 'user-attacker',
    } as any;

    await request(app.getHttpServer())
      .post('/transactions')
      .send(body)
      .expect(201);

    expect(txServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('create: propagates request trace metadata from headers', async () => {
    const body = {
      account_id: 'acc1',
      category_id: 'cat1',
      transaction_type: 'EXPENSE',
      amount_cents: 1000,
      transaction_date: new Date().toISOString(),
    } as any;

    await request(app.getHttpServer())
      .post('/transactions')
      .set('x-correlation-id', 'corr-trace-1')
      .set('x-request-id', 'req-trace-1')
      .send(body)
      .expect(201);

    expect(txServiceMock.create).toHaveBeenCalled();
    const trace = txServiceMock.create.mock.calls[0][2];
    expect(trace).toEqual({
      correlationId: 'corr-trace-1',
      requestId: 'req-trace-1',
    });
  });

  it('update: passes authenticated userId to service and ignores client-supplied userId', async () => {
    const body = { note: 'updated', userId: 'user-attacker' } as any;
    await request(app.getHttpServer())
      .patch('/transactions/t1')
      .send(body)
      .expect(200);

    expect(txServiceMock.update).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/transactions/t1').expect(200);
    expect(txServiceMock.getById).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).delete('/transactions/t1').expect(200);
    expect(txServiceMock.softDelete).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/transactions').expect(200);
    expect(txServiceMock.listAll).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('search: passes authenticated userId to service', async () => {
    await request(app.getHttpServer())
      .get('/transactions/search?q=rent')
      .expect(200);
    expect(txServiceMock.search).toHaveBeenCalled();
    const calledWithUserId = txServiceMock.search.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
