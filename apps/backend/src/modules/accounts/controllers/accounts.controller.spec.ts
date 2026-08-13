import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../services/accounts.service';
import { BalanceService } from '../services/balance.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('AccountsController (security)', () => {
  let app: INestApplication;
  let accountsServiceMock: any;

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
    const accountEntity = {
      id: 'acc1',
      name: 'A',
      account_type: 'CASH',
      currency: 'IDR',
      opening_balance_cents: BigInt(0),
      current_balance_cents: BigInt(0),
      color: null,
      icon: null,
      description: null,
      is_active: true,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    accountsServiceMock = {
      listAll: jest.fn().mockResolvedValue([accountEntity]),
      getById: jest.fn().mockResolvedValue(accountEntity),
      create: jest.fn().mockResolvedValue(accountEntity),
      update: jest.fn().mockResolvedValue(accountEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
      setDefault: jest.fn().mockResolvedValue(undefined),
      recalculateAll: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: accountsServiceMock },
        { provide: BalanceService, useValue: {} },
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

  it('create: passes authenticated userId to service and ignores client-supplied userId', async () => {
    const body = {
      name: 'My Account',
      account_type: 'CASH',
      userId: 'user-attacker',
    } as any;

    await request(app.getHttpServer()).post('/accounts').send(body);

    expect(accountsServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = accountsServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId to service and ignores client-supplied userId', async () => {
    const body = { name: 'Updated', userId: 'user-attacker' } as any;
    await request(app.getHttpServer()).patch('/accounts/acc1').send(body);

    expect(accountsServiceMock.update).toHaveBeenCalled();
    const calledWithUserId = accountsServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/accounts/acc1');
    expect(accountsServiceMock.getById).toHaveBeenCalled();
    const calledWithUserId = accountsServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).delete('/accounts/acc1');
    expect(accountsServiceMock.softDelete).toHaveBeenCalled();
    const calledWithUserId = accountsServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/accounts');
    expect(accountsServiceMock.listAll).toHaveBeenCalled();
    const calledWithUserId = accountsServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
