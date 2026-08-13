import { Controller, Get, INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'net';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from '../types/auth-user';

@Controller('test-user')
class TestUserController {
  @Get('whole')
  whole(@CurrentUser() user: AuthUser | undefined): Record<string, unknown> {
    return { user };
  }

  @Get('sub')
  sub(@CurrentUser('sub') sub: string | undefined): Record<string, unknown> {
    return { sub };
  }

  @Get('role')
  role(@CurrentUser('role') role: string | undefined): Record<string, unknown> {
    return { role };
  }

  @Get('email')
  email(
    @CurrentUser('email') email: string | undefined,
  ): Record<string, unknown> {
    return { email };
  }
}

describe('CurrentUser decorator', () => {
  let app: INestApplication;
  let attachedUser: AuthUser | undefined;

  beforeEach(async () => {
    attachedUser = {
      sub: 'u1',
      role: 'USER',
      email: 'user1@example.com',
      jti: 'jti-1',
      sessionId: 'session-1',
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestUserController],
    }).compile();

    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user?: AuthUser }).user = attachedUser;
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the whole user object when used without data', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/test-user/whole')
      .expect(200);

    const body = res.body as { user: AuthUser | undefined };
    expect(body.user).toEqual({
      sub: 'u1',
      role: 'USER',
      email: 'user1@example.com',
      jti: 'jti-1',
      sessionId: 'session-1',
    });
  });

  it('returns only the requested property when passed data', async () => {
    const sub = await request(app.getHttpServer() as Server)
      .get('/test-user/sub')
      .expect(200);
    const role = await request(app.getHttpServer() as Server)
      .get('/test-user/role')
      .expect(200);

    expect(sub.body).toEqual({ sub: 'u1' });
    expect(role.body).toEqual({ role: 'USER' });
  });

  it('returns undefined for a property that is absent from the user', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/test-user/email')
      .expect(200);

    expect(res.body).toEqual({ email: 'user1@example.com' });

    attachedUser = { sub: 'u2' };
    const missing = await request(app.getHttpServer() as Server)
      .get('/test-user/email')
      .expect(200);
    expect(missing.body).toEqual({ email: undefined });
  });

  it('resolves undefined users to undefined instead of throwing', async () => {
    attachedUser = undefined;

    const whole = await request(app.getHttpServer() as Server)
      .get('/test-user/whole')
      .expect(200);
    const sub = await request(app.getHttpServer() as Server)
      .get('/test-user/sub')
      .expect(200);

    const body = whole.body as { user: AuthUser | undefined };
    expect(body.user).toBeUndefined();
    expect(sub.body).toEqual({ sub: undefined });
  });
});
