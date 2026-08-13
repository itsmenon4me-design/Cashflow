import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from '../services/investments.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('InvestmentsController (security)', () => {
  let app: INestApplication;
  let investmentsServiceMock: any;

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
    const investmentEntity = {
      id: 'inv1',
      user_id: 'user-auth',
      account_id: null,
      investment_type: 'Stock',
      platform: 'Exchange',
      name: 'AAPL',
      symbol: 'AAPL',
      quantity: '10',
      average_buy_price: '150.5',
      current_price: '180.0',
      invested_amount_cents: BigInt(150500),
      current_value_cents: BigInt(180000),
      profit_loss_cents: BigInt(29500),
      profit_loss_percentage: '19.60',
      purchase_date: new Date(),
      notes: null,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    } as any;

    const overviewResult = {
      total: 1,
      active: 1,
      totalInvested: '150500',
      totalValue: '180000',
      totalProfit: '29500',
      totalLoss: '0',
      roi: 19.6,
      allocation: [{ type: 'Stock', total: '180000' }],
    } as any;

    investmentsServiceMock = {
      listAll: jest.fn().mockResolvedValue([investmentEntity]),
      overview: jest.fn().mockResolvedValue(overviewResult),
      getById: jest.fn().mockResolvedValue(investmentEntity),
      create: jest.fn().mockResolvedValue(investmentEntity),
      update: jest.fn().mockResolvedValue(investmentEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvestmentsController],
      providers: [
        { provide: InvestmentsService, useValue: investmentsServiceMock },
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
      investment_type: 'Stock',
      platform: 'Exchange',
      name: 'AAPL',
      quantity: 10,
      average_buy_price: 150.5,
      current_price: 180,
      purchase_date: '2026-01-01',
      userId: 'attacker',
      user_id: 'attacker',
    } as any;
    await request(app.getHttpServer())
      .post('/investments')
      .send(body)
      .expect(201);

    expect(investmentsServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = {
      name: 'MSFT',
      userId: 'attacker',
      user_id: 'attacker',
    } as any;
    await request(app.getHttpServer())
      .patch('/investments/inv1')
      .send(body)
      .expect(200);

    expect(investmentsServiceMock.update).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/investments/inv1').expect(200);

    expect(investmentsServiceMock.getById).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).delete('/investments/inv1').expect(200);

    expect(investmentsServiceMock.softDelete).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/investments').expect(200);

    expect(investmentsServiceMock.listAll).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('overview: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/investments/overview').expect(200);

    expect(investmentsServiceMock.overview).toHaveBeenCalled();
    const calledWithUserId = investmentsServiceMock.overview.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
