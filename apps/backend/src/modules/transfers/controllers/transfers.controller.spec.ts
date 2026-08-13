import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransfersController } from './transfers.controller';
import { TransfersService } from '../services/transfers.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('TransfersController (security)', () => {
  let app: INestApplication;
  let transfersServiceMock: any;

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
          sessionId: 'session-auth',
          jti: 'jti-auth',
        };
      }
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    shouldAttachUser: true,
  };

  beforeEach(async () => {
    const transferResult = {
      id: 't1',
      source_transaction_id: 'out1',
      destination_transaction_id: 'in1',
      amount_cents: '50000',
      reference: null,
      created_at: new Date(),
    } as any;

    transfersServiceMock = {
      create: jest.fn().mockResolvedValue(transferResult),
      list: jest.fn().mockResolvedValue([transferResult]),
      findById: jest.fn().mockResolvedValue(transferResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        { provide: TransfersService, useValue: transfersServiceMock },
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

  it('create: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = {
      source_account_id: 'src1',
      destination_account_id: 'dst1',
      amount_cents: 50000,
      transaction_date: '2026-01-01',
      userId: 'user-attacker',
      user_id: 'user-attacker',
    } as any;
    await request(app.getHttpServer())
      .post('/transfers')
      .send(body)
      .expect(201);

    expect(transfersServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = transfersServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('create: never uses req.user.id (non-whitelisted claim)', async () => {
    await request(app.getHttpServer())
      .post('/transfers')
      .send({
        source_account_id: 'src1',
        destination_account_id: 'dst1',
        amount_cents: 50000,
      })
      .expect(201);

    expect(transfersServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = transfersServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer())
      .get('/transfers')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(transfersServiceMock.list).toHaveBeenCalled();
    const calledWithUserId = transfersServiceMock.list.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('findById: passes authenticated userId and route id', async () => {
    await request(app.getHttpServer())
      .get('/transfers/t1')
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);

    expect(transfersServiceMock.findById).toHaveBeenCalled();
    const [calledWithUserId, id] = transfersServiceMock.findById.mock.calls[0];
    expect(calledWithUserId).toBe('user-auth');
    expect(id).toBe('t1');
  });
});
