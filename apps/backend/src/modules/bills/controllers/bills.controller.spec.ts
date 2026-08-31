import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BillsController } from './bills.controller';
import { BillsService } from '../services/bills.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AppValidationPipe } from '../../../common/pipes/validation.pipe';

describe('BillsController (security)', () => {
  let app: INestApplication;
  let billsServiceMock: {
    list: jest.Mock;
    upcoming: jest.Mock;
    getById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };

  const authGuard: CanActivate & { isAuthenticated: boolean } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user: { sub: string; role: string; email: string } }>();
      req.user = { sub: 'user-auth', role: 'USER', email: 'auth@example.com' };
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
  };

  const billId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const otherUserBillId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  const billEntity = {
    id: billId,
    user_id: 'user-auth',
    payee: 'Electricity',
    amount_cents: BigInt(50000),
    currency: 'IDR',
    category_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    due_date: new Date('2026-09-01T00:00:00Z'),
    due_date_timezone: 'Asia/Jakarta',
    is_paid: false,
    paid_at: null,
    transaction_id: null,
    status: 'OPEN',
    recurrence_type: 'NONE',
    recurrence_interval: null,
    recurrence_ends_at: null,
    series_id: null,
    is_template: false,
    reminder_enabled: true,
    reminder_days_before: 1,
    reminder_time: null,
    reminder_config: null,
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-01T00:00:00Z'),
    deleted_at: null,
  };

  beforeEach(async () => {
    billsServiceMock = {
      list: jest.fn().mockResolvedValue([billEntity]),
      upcoming: jest.fn().mockResolvedValue([billEntity]),
      getById: jest.fn().mockResolvedValue(billEntity),
      create: jest.fn().mockResolvedValue(billEntity),
      update: jest.fn().mockResolvedValue(billEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillsController],
      providers: [{ provide: BillsService, useValue: billsServiceMock }],
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
    authGuard.isAuthenticated = true;
  });

  const validCreateBody = {
    payee: 'Internet',
    amount_cents: 120000,
    category_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    due_date: '2026-09-01T00:00:00.000Z',
    due_date_timezone: 'Asia/Jakarta',
  };

  it.each([
    ['GET', '/bills', undefined],
    ['GET', '/bills/upcoming', undefined],
    ['GET', `/bills/${billId}`, undefined],
    ['POST', '/bills', undefined],
    ['PATCH', `/bills/${billId}`, { payee: 'X' }],
    ['DELETE', `/bills/${billId}`, undefined],
  ])('%s %s rejects unauthenticated requests', async (method, url, body) => {
    authGuard.isAuthenticated = false;
    const base = request(app.getHttpServer() as Parameters<typeof request>[0]);
    const pending =
      method === 'GET'
        ? base.get(url)
        : method === 'POST'
          ? base.post(url)
          : method === 'PATCH'
            ? base.patch(url).send(body)
            : base.delete(url);
    await pending.expect(403);
  });

  it('all unauthenticated bill requests leave the service untouched', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/bills')
      .expect(403);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/bills/upcoming')
      .expect(403);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/bills/${billId}`)
      .expect(403);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/bills')
      .send(validCreateBody)
      .expect(403);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch(`/bills/${billId}`)
      .send({ payee: 'X' })
      .expect(403);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .delete(`/bills/${billId}`)
      .expect(403);
    for (const fn of [
      'list',
      'upcoming',
      'getById',
      'create',
      'update',
      'softDelete',
    ] as const) {
      expect(billsServiceMock[fn]).not.toHaveBeenCalled();
    }
  });

  it('GET /bills: passes authenticated userId', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/bills')
      .query({
        userId: 'user-attacker',
        user_id: 'user-attacker',
        sub: 'user-attacker',
      })
      .expect(200);
    expect(billsServiceMock.list).toHaveBeenCalledWith('user-auth');
  });

  it('GET /bills/:id: passes authenticated userId and ignores attacker query', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/bills/${billId}`)
      .query({ userId: 'user-attacker', user_id: 'user-attacker' })
      .expect(200);
    expect(billsServiceMock.getById).toHaveBeenCalledWith('user-auth', billId);
  });

  it('by-id access: rejects records owned by another user with 404', async () => {
    billsServiceMock.getById.mockRejectedValueOnce(
      new NotFoundException('Bill not found'),
    );
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/bills/${otherUserBillId}`)
      .expect(404);

    billsServiceMock.update.mockRejectedValueOnce(
      new NotFoundException('Bill not found'),
    );
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch(`/bills/${otherUserBillId}`)
      .send({ payee: 'Hijacked' })
      .expect(404);

    billsServiceMock.softDelete.mockRejectedValueOnce(
      new NotFoundException('Bill not found'),
    );
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .delete(`/bills/${otherUserBillId}`)
      .expect(404);
  });

  it('POST /bills: attacker body userId is rejected by validation (forbidNonWhitelisted)', async () => {
    const attackerBody = {
      ...validCreateBody,
      userId: 'user-attacker',
      user_id: 'user-attacker',
      sub: 'user-attacker',
    };
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/bills')
      .send(attackerBody)
      .expect(400);
    expect(billsServiceMock.create).not.toHaveBeenCalled();
  });

  it('POST /bills: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/bills')
      .send(validCreateBody)
      .expect(201);
    expect(billsServiceMock.create).toHaveBeenCalled();
    const createUserId = (
      billsServiceMock.create.mock.calls[0] as unknown[]
    )[0] as string;
    expect(createUserId).toBe('user-auth');
  });

  it('PATCH /bills/:id: attacker body userId is rejected by validation', async () => {
    const attackerBody = {
      payee: 'X',
      userId: 'user-attacker',
      user_id: 'user-attacker',
    };
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch(`/bills/${billId}`)
      .send(attackerBody)
      .expect(400);
    expect(billsServiceMock.update).not.toHaveBeenCalled();
  });

  it('PATCH /bills/:id: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch(`/bills/${billId}`)
      .send({ payee: 'X' })
      .expect(200);
    expect(billsServiceMock.update).toHaveBeenCalled();
    const [userId, id] = billsServiceMock.update.mock.calls[0] as [
      string,
      string,
    ];
    expect(userId).toBe('user-auth');
    expect(id).toBe(billId);
  });

  it('DELETE /bills/:id: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .delete(`/bills/${billId}`)
      .expect(200);
    expect(billsServiceMock.softDelete).toHaveBeenCalledWith(
      'user-auth',
      billId,
    );
  });

  it('GET /bills/upcoming: passes authenticated userId and forwards date window', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/bills/upcoming')
      .query({ from: '2026-09-01', to: '2026-12-01' })
      .expect(200);
    expect(billsServiceMock.upcoming).toHaveBeenCalledWith(
      'user-auth',
      '2026-09-01',
      '2026-12-01',
    );
  });
});
