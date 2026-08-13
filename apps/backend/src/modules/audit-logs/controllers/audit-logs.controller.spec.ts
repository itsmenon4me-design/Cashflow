import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from '../services/audit-logs.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AdminAuditRateLimitGuard } from '../guards/admin-audit-rate-limit.guard';
import {
  AUDIT_METADATA_KEY,
  AuditMetadata,
} from '../../../common/audit/audit.decorator';
import {
  AuditAction,
  AuditEntityType,
  AuditModule,
} from '../constants/audit.constants';

describe('AuditLogsController (security)', () => {
  let app: INestApplication;
  let auditLogsServiceMock: any;
  let moduleRef: TestingModule;

  const authGuard: CanActivate & { isAuthenticated: boolean; role: string } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'user-auth',
        role: authGuard.role,
        email: 'auth@example.com',
      };
      return authGuard.isAuthenticated;
    }),
    isAuthenticated: true,
    role: 'USER',
  };

  const auditEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 'user-auth',
    action: 'AUTH_LOGIN',
    module: 'AUTHENTICATION',
    description: 'login success',
    entity_type: 'USER',
    entity_id: 'user-auth',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    request_method: 'POST',
    request_path: '/auth/login',
    response_status: 201,
    metadata: null,
    created_at: new Date('2026-08-01T00:00:00Z'),
  } as any;

  beforeEach(async () => {
    auditLogsServiceMock = {
      findOwnByUser: jest
        .fn()
        .mockResolvedValue({ items: [auditEntity], total: 1 }),
      findOwnById: jest.fn().mockResolvedValue(auditEntity),
      findMany: jest.fn().mockResolvedValue({ items: [auditEntity], total: 1 }),
      findById: jest.fn().mockResolvedValue(auditEntity),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        { provide: AuditLogsService, useValue: auditLogsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(AdminAuditRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    moduleRef = module;
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    authGuard.isAuthenticated = true;
    authGuard.role = 'USER';
  });

  it('myList: passes authenticated userId and strips attacker-supplied userId from filter', async () => {
    const attackerId = '11111111-2222-4333-8444-555555555555';
    const query = {
      userId: attackerId,
      user_id: attackerId,
      sub: attackerId,
    };
    await request(app.getHttpServer())
      .get('/audit-logs/me')
      .query(query)
      .expect(200);

    expect(auditLogsServiceMock.findOwnByUser).toHaveBeenCalled();
    const [userId, filter, pagination] =
      auditLogsServiceMock.findOwnByUser.mock.calls[0];
    expect(userId).toBe('user-auth');
    expect(filter.userId).toBeUndefined();
    expect(pagination).toEqual({ page: 1, limit: 10 });
  });

  it('myList: identity comes from AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer()).get('/audit-logs/me').expect(403);
    expect(auditLogsServiceMock.findOwnByUser).not.toHaveBeenCalled();
  });

  it('myFindOne: passes authenticated userId and ignores attacker-supplied userId', async () => {
    const query = { userId: 'user-attacker', user_id: 'user-attacker' };
    await request(app.getHttpServer())
      .get('/audit-logs/me/550e8400-e29b-41d4-a716-446655440000')
      .query(query)
      .expect(200);

    expect(auditLogsServiceMock.findOwnById).toHaveBeenCalled();
    const [userId, id] = auditLogsServiceMock.findOwnById.mock.calls[0];
    expect(userId).toBe('user-auth');
    expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('myFindOne: identity comes from AuthUser context, not arbitrary request data', async () => {
    authGuard.isAuthenticated = false;
    await request(app.getHttpServer())
      .get('/audit-logs/me/550e8400-e29b-41d4-a716-446655440000')
      .expect(403);
    expect(auditLogsServiceMock.findOwnById).not.toHaveBeenCalled();
  });

  it('list: blocks non-SUPER_ADMIN roles', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(403);
    expect(auditLogsServiceMock.findMany).not.toHaveBeenCalled();
  });

  it('list: allows SUPER_ADMIN and forwards filter including userId', async () => {
    authGuard.role = 'SUPER_ADMIN';
    const targetId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ userId: targetId, action: 'AUTH_LOGIN' })
      .expect(200);

    expect(auditLogsServiceMock.findMany).toHaveBeenCalled();
    const [filter] = auditLogsServiceMock.findMany.mock.calls[0];
    expect(filter.userId).toBe(targetId);
    expect(filter.action).toBe('AUTH_LOGIN');
  });

  it('findOne: blocks non-SUPER_ADMIN roles', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs/550e8400-e29b-41d4-a716-446655440000')
      .expect(403);
    expect(auditLogsServiceMock.findById).not.toHaveBeenCalled();
  });

  it('findOne: allows SUPER_ADMIN to read any audit log by id', async () => {
    authGuard.role = 'SUPER_ADMIN';
    await request(app.getHttpServer())
      .get('/audit-logs/550e8400-e29b-41d4-a716-446655440000')
      .expect(200);
    expect(auditLogsServiceMock.findById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('list: rejects a malformed (non-UUID) userId with 400, no service call', async () => {
    authGuard.role = 'SUPER_ADMIN';
    await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ userId: 'not-a-uuid' })
      .expect(400);
    expect(auditLogsServiceMock.findMany).not.toHaveBeenCalled();
  });

  it('list: returns safely when userId does not exist (valid UUID, empty result)', async () => {
    authGuard.role = 'SUPER_ADMIN';
    auditLogsServiceMock.findMany.mockResolvedValueOnce({
      items: [],
      total: 0,
    });
    const ghostId = '99999999-8888-4777-8666-555555555555';
    const response = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ userId: ghostId })
      .expect(200);

    expect(auditLogsServiceMock.findMany).toHaveBeenCalled();
    const [filter] = auditLogsServiceMock.findMany.mock.calls[0];
    expect(filter.userId).toBe(ghostId);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  const auditMetaOf = (handler: unknown): AuditMetadata | undefined =>
    moduleRef
      .get(Reflector)
      .getAllAndOverride<AuditMetadata>(AUDIT_METADATA_KEY, [
        handler as () => unknown,
        AuditLogsController,
      ]);

  it('admin list is marked @Audit AUDIT_VIEW and never targets the admin own sub', () => {
    const meta = auditMetaOf(AuditLogsController.prototype.list);
    expect(meta?.action).toBe(AuditAction.AUDIT_VIEW);
    expect(meta?.module).toBe(AuditModule.AUDIT);
    expect(meta?.entityType).toBe(AuditEntityType.AUDIT_LOG);
    // No userId filter metadata exists; the interceptor records only params.id and
    // the originalUrl (which carries ?userId=...) — the admin's own sub is never a filter.
    expect(meta?.description).toBeUndefined();
  });

  it('admin findOne is marked @Audit AUDIT_VIEW', () => {
    const meta = auditMetaOf(AuditLogsController.prototype.findOne);
    expect(meta?.action).toBe(AuditAction.AUDIT_VIEW);
    expect(meta?.module).toBe(AuditModule.AUDIT);
    expect(meta?.entityType).toBe(AuditEntityType.AUDIT_LOG);
  });

  it('/me endpoints are NOT marked @Audit AUDIT_VIEW', () => {
    expect(auditMetaOf(AuditLogsController.prototype.myList)).toBeUndefined();
    expect(
      auditMetaOf(AuditLogsController.prototype.myFindOne),
    ).toBeUndefined();
  });

  it('admin routes are guarded by AdminAuditRateLimitGuard alongside auth guards', () => {
    const listGuards = Reflect.getMetadata(
      '__guards__',
      AuditLogsController.prototype.list,
    );
    const findOneGuards = Reflect.getMetadata(
      '__guards__',
      AuditLogsController.prototype.findOne,
    );
    for (const guards of [listGuards, findOneGuards]) {
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards).toContain(AdminAuditRateLimitGuard);
    }
  });

  it('/me route guards remain JwtAuthGuard only', () => {
    const myListGuards = Reflect.getMetadata(
      '__guards__',
      AuditLogsController.prototype.myList,
    );
    const myFindOneGuards = Reflect.getMetadata(
      '__guards__',
      AuditLogsController.prototype.myFindOne,
    );
    expect(myListGuards).toEqual([JwtAuthGuard]);
    expect(myFindOneGuards).toEqual([JwtAuthGuard]);
  });
});
