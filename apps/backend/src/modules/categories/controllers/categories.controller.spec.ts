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
import { CategoriesController } from './categories.controller';
import { CategoriesService } from '../services/categories.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('CategoriesController (security)', () => {
  let app: INestApplication;
  let categoriesServiceMock: jest.Mocked<CategoriesService>;

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
    const categoryEntity = {
      id: 'cat1',
      name: 'Food',
      type: 'EXPENSE',
      icon: null,
      color: null,
      description: null,
      is_system: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    categoriesServiceMock = {
      listAll: jest.fn().mockResolvedValue([categoryEntity]),
      listByType: jest.fn().mockResolvedValue([categoryEntity]),
      getById: jest.fn().mockResolvedValue(categoryEntity),
      create: jest.fn().mockResolvedValue(categoryEntity),
      update: jest.fn().mockResolvedValue(categoryEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CategoriesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: categoriesServiceMock },
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
      name: 'Food',
      type: 'EXPENSE',
      userId: 'user-attacker',
      user_id: 'user-attacker',
    };
    await request(app.getHttpServer() as Server)
      .post('/categories')
      .send(body)
      .expect(201);

    expect(
      (categoriesServiceMock as unknown as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.create.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('update: passes authenticated userId and ignores client-supplied userId', async () => {
    const body = { name: 'Updated', userId: 'user-attacker' };
    await request(app.getHttpServer() as Server)
      .patch('/categories/cat1')
      .send(body)
      .expect(200);

    expect(
      (categoriesServiceMock as unknown as { update: jest.Mock }).update,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.update.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('getById: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/categories/cat1')
      .expect(200);
    expect(
      (categoriesServiceMock as unknown as { getById: jest.Mock }).getById,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.getById.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('by-id access: rejects records owned by another user with 404', async () => {
    categoriesServiceMock.getById.mockRejectedValueOnce(
      new NotFoundException('Category not found'),
    );
    await request(app.getHttpServer() as Server)
      .get('/categories/other-user-category')
      .expect(404);

    categoriesServiceMock.update.mockRejectedValueOnce(
      new NotFoundException('Category not found'),
    );
    await request(app.getHttpServer() as Server)
      .patch('/categories/other-user-category')
      .send({ name: 'Hijacked' })
      .expect(404);

    categoriesServiceMock.softDelete.mockRejectedValueOnce(
      new NotFoundException('Category not found'),
    );
    await request(app.getHttpServer() as Server)
      .delete('/categories/other-user-category')
      .expect(404);
  });

  it('delete: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .delete('/categories/cat1')
      .expect(200);
    expect(
      (categoriesServiceMock as unknown as { softDelete: jest.Mock })
        .softDelete,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.softDelete.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('list: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/categories')
      .expect(200);
    expect(
      (categoriesServiceMock as unknown as { listAll: jest.Mock }).listAll,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.listAll.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });

  it('listByType: passes authenticated userId to service', async () => {
    await request(app.getHttpServer() as Server)
      .get('/categories/type/EXPENSE')
      .expect(200);
    expect(
      (categoriesServiceMock as unknown as { listByType: jest.Mock })
        .listByType,
    ).toHaveBeenCalled();
    const calledWithUserId = categoriesServiceMock.listByType.mock.calls[0][0];
    expect(calledWithUserId).toBe('user-auth');
  });
});
