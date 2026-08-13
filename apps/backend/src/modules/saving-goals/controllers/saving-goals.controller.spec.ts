import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SavingGoalsController } from './saving-goals.controller';
import { SavingGoalsService } from '../services/saving-goals.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('SavingGoalsController (security)', () => {
  let app: INestApplication;
  let goalsServiceMock: any;

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
    const goalEntity = {
      id: 'g1',
      user_id: 'user-auth',
      account_id: null,
      category_id: null,
      name: 'Trip',
      description: 'Vacation',
      target_amount_cents: BigInt(200000),
      current_amount_cents: BigInt(50000),
      start_date: '2026-01-01',
      target_date: '2026-12-31',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    goalsServiceMock = {
      listAll: jest.fn().mockResolvedValue([goalEntity]),
      overview: jest.fn().mockResolvedValue({ total_goals: 1 }),
      getById: jest.fn().mockResolvedValue(goalEntity),
      create: jest.fn().mockResolvedValue(goalEntity),
      update: jest.fn().mockResolvedValue(goalEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingGoalsController],
      providers: [{ provide: SavingGoalsService, useValue: goalsServiceMock }],
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
      name: 'Trip',
      target_amount_cents: 200000,
      start_date: '2026-01-01',
      target_date: '2026-12-31',
      userId: 'user-attacker',
      user_id: 'user-attacker',
    } as any;
    await request(app.getHttpServer())
      .post('/saving-goals')
      .send(body)
      .expect(201);

    expect(goalsServiceMock.create).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = { name: 'Trip updated', userId: 'user-attacker' } as any;
    await request(app.getHttpServer())
      .patch('/saving-goals/g1')
      .send(body)
      .expect(200);

    expect(goalsServiceMock.update).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/saving-goals/g1').expect(200);
    expect(goalsServiceMock.getById).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).delete('/saving-goals/g1').expect(200);
    expect(goalsServiceMock.softDelete).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer()).get('/saving-goals').expect(200);
    expect(goalsServiceMock.listAll).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('overview: passes authenticated userId to service', async () => {
    await request(app.getHttpServer())
      .get('/saving-goals/overview')
      .expect(200);
    expect(goalsServiceMock.overview).toHaveBeenCalled();
    const calledWithUserId = goalsServiceMock.overview.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
