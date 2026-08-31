import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersMeController } from './users-me.controller';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UserEntity } from '../entities/user.entity';

describe('UsersController (security)', () => {
  let app: INestApplication;
  let usersServiceMock: {
    listAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    deleteOwnAccount: jest.Mock;
  };

  const authGuard: CanActivate & { isAuthenticated: boolean; role: string } = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user: { sub: string; role: string; email: string } }>();
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

  const userEntity: UserEntity = {
    id: 'user-auth',
    email: 'auth@example.com',
    username: 'authuser',
    full_name: 'Auth User',
    avatar_url: null,
    phone_number: null,
    status: 'ACTIVE',
    password_hash: 'should-never-leak',
    email_verified_at: new Date('2026-08-01T00:00:00Z'),
    last_login_at: null,
    created_at: new Date('2026-07-01T00:00:00Z'),
    updated_at: new Date('2026-07-01T00:00:00Z'),
  };

  beforeEach(async () => {
    usersServiceMock = {
      listAll: jest.fn().mockResolvedValue([userEntity]),
      findById: jest.fn().mockResolvedValue(userEntity),
      create: jest.fn().mockResolvedValue(userEntity),
      update: jest.fn().mockResolvedValue(userEntity),
      softDelete: jest.fn().mockResolvedValue(undefined),
      deleteOwnAccount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersMeController, UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    const expressAdapter = app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void };
    expressAdapter.set('strict routing', true);
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

  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  describe('GET /users/:id', () => {
    it('rejects unauthenticated access', async () => {
      authGuard.isAuthenticated = false;
      await http().get('/users/user-auth').expect(403);
      expect(usersServiceMock.findById).not.toHaveBeenCalled();
    });

    it('rejects an authenticated user reading another user record', async () => {
      await http().get('/users/another-user').expect(403);
      expect(usersServiceMock.findById).not.toHaveBeenCalled();
    });

    it('allows an authenticated user reading their own record', async () => {
      const response = await http().get('/users/user-auth').expect(200);
      expect(usersServiceMock.findById).toHaveBeenCalledWith('user-auth');
      expect((response.body as { id: string }).id).toBe('user-auth');
    });

    it('never exposes password_hash in the response', async () => {
      const response = await http().get('/users/user-auth').expect(200);
      expect(
        (response.body as { password_hash?: string }).password_hash,
      ).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('should-never-leak');
    });
  });

  describe('PATCH /users/:id', () => {
    it('rejects unauthenticated access', async () => {
      authGuard.isAuthenticated = false;
      await http()
        .patch('/users/user-auth')
        .send({ full_name: 'Alexander' })
        .expect(403);
      expect(usersServiceMock.update).not.toHaveBeenCalled();
    });

    it('rejects modifying another user record', async () => {
      await http()
        .patch('/users/another-user')
        .send({ full_name: 'Alexander' })
        .expect(403);
      expect(usersServiceMock.update).not.toHaveBeenCalled();
    });

    it('allows modifying own record', async () => {
      await http()
        .patch('/users/user-auth')
        .send({ full_name: 'Alexander' })
        .expect(200);
      expect(usersServiceMock.update).toHaveBeenCalledWith('user-auth', {
        full_name: 'Alexander',
      });
    });
  });

  describe('POST /users/me/delete-account', () => {
    it('rejects unauthenticated access', async () => {
      authGuard.isAuthenticated = false;
      await http()
        .post('/users/me/delete-account')
        .send({ email: 'auth@example.com', password: 'StrongPass123!' })
        .expect(403);
      expect(usersServiceMock.deleteOwnAccount).not.toHaveBeenCalled();
    });

    it('requires matching email and password before deletion', async () => {
      await http()
        .post('/users/me/delete-account')
        .send({ email: 'auth@example.com', password: 'StrongPass123!' })
        .expect(201);
      expect(usersServiceMock.deleteOwnAccount).toHaveBeenCalledWith(
        'user-auth',
        'auth@example.com',
        { email: 'auth@example.com', password: 'StrongPass123!' },
      );
    });
  });

  describe('DELETE /users/:id', () => {
    it('rejects unauthenticated access', async () => {
      authGuard.isAuthenticated = false;
      await http().delete('/users/user-auth').expect(403);
      expect(usersServiceMock.softDelete).not.toHaveBeenCalled();
    });

    it('rejects deleting another user record', async () => {
      await http().delete('/users/another-user').expect(403);
      expect(usersServiceMock.softDelete).not.toHaveBeenCalled();
    });

    it('allows deleting own record', async () => {
      await http().delete('/users/user-auth').expect(200);
      expect(usersServiceMock.softDelete).toHaveBeenCalledWith('user-auth');
    });
  });

  describe('POST /users/create', () => {
    it('rejects unauthenticated creation', async () => {
      authGuard.isAuthenticated = false;
      await http()
        .post('/users/create')
        .send({
          email: 'new@example.com',
          username: 'newuser',
          full_name: 'New User',
          password: 'StrongPass123!',
        })
        .expect(403);
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejects non-SUPER_ADMIN creation', async () => {
      await http()
        .post('/users/create')
        .send({
          email: 'new@example.com',
          username: 'newuser',
          full_name: 'New User',
          password: 'StrongPass123!',
        })
        .expect(403);
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN creation', async () => {
      authGuard.role = 'SUPER_ADMIN';
      await http()
        .post('/users/create')
        .send({
          email: 'new@example.com',
          username: 'newuser',
          full_name: 'New User',
          password: 'StrongPass123!',
        })
        .expect(201);
      expect(usersServiceMock.create).toHaveBeenCalled();
    });
  });

  describe('GET /users (list)', () => {
    it('keeps blocking non-SUPER_ADMIN roles', async () => {
      await http().get('/users').expect(403);
      expect(usersServiceMock.listAll).not.toHaveBeenCalled();
    });

    it('keeps allowing SUPER_ADMIN', async () => {
      authGuard.role = 'SUPER_ADMIN';
      const response = await http().get('/users').expect(200);
      expect(usersServiceMock.listAll).toHaveBeenCalled();
      const body = response.body as Array<{ password_hash?: string }>;
      expect(body.length).toBe(1);
      expect(body[0].password_hash).toBeUndefined();
    });
  });
});
