import { CanActivate, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { EmailController } from './email.controller';
import { EmailVerificationService } from '../services/email-verification.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../../common/mail/mail.service';
import { MailConfigService } from '../../../config/mail-config.service';
import { PrismaUsersRepository } from '../../users/repositories/prisma-users.repository';
import { AuthRateLimitGuard } from '../auth-rate-limit.guard';
import { UserEntity } from '../../users/entities/user.entity';

describe('EmailController (security)', () => {
  let app: INestApplication;
  let verificationMock: {
    sendVerificationEmail: jest.Mock;
    verifyToken: jest.Mock;
  };
  let usersServiceMock: { findByEmail: jest.Mock };
  let mailServiceMock: { sendPasswordReset: jest.Mock };
  let usersRepoMock: { update: jest.Mock };
  const rateLimitGuard: CanActivate & { allowed: boolean } = {
    canActivate: jest.fn(() => rateLimitGuard.allowed),
    allowed: true,
  };

  const user = {
    id: 'u1',
    email: 'a@b.com',
    full_name: 'A B',
    password_reset_requested_at: null,
  } as unknown as UserEntity;

  beforeEach(async () => {
    verificationMock = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      verifyToken: jest.fn().mockResolvedValue(undefined),
    };
    usersServiceMock = { findByEmail: jest.fn().mockResolvedValue(user) };
    mailServiceMock = { sendPasswordReset: jest.fn() };
    usersRepoMock = { update: jest.fn().mockResolvedValue(user) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        { provide: EmailVerificationService, useValue: verificationMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: MailConfigService, useValue: {} },
        { provide: PrismaUsersRepository, useValue: usersRepoMock },
      ],
    })
      .overrideGuard(AuthRateLimitGuard)
      .useValue(rateLimitGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rateLimitGuard.allowed = true;
  });

  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  describe('POST /auth/email/send-verification', () => {
    it('rejects a malformed email', async () => {
      await http()
        .post('/auth/email/send-verification')
        .send({ email: 'not-an-email' })
        .expect(400);
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('rejects an empty email', async () => {
      await http()
        .post('/auth/email/send-verification')
        .send({ email: '' })
        .expect(400);
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('accepts a valid email', async () => {
      await http()
        .post('/auth/email/send-verification')
        .send({ email: 'a@b.com' })
        .expect(201);
      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('a@b.com');
      expect(verificationMock.sendVerificationEmail).toHaveBeenCalledWith('u1');
    });

    it('responds generically for unknown emails without sending', async () => {
      usersServiceMock.findByEmail.mockResolvedValueOnce(null);
      const response = await http()
        .post('/auth/email/send-verification')
        .send({ email: 'ghost@b.com' })
        .expect(201);
      expect(response.body).toEqual({ success: true });
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('is rate limited per IP', async () => {
      rateLimitGuard.allowed = false;
      await http()
        .post('/auth/email/send-verification')
        .send({ email: 'a@b.com' })
        .expect(403);
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/email/resend', () => {
    it('rejects a malformed email', async () => {
      await http()
        .post('/auth/email/resend')
        .send({ email: 'bad' })
        .expect(400);
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('accepts a valid email', async () => {
      await http()
        .post('/auth/email/resend')
        .send({ email: 'a@b.com' })
        .expect(201);
      expect(verificationMock.sendVerificationEmail).toHaveBeenCalledWith('u1');
    });

    it('is rate limited per IP', async () => {
      rateLimitGuard.allowed = false;
      await http()
        .post('/auth/email/resend')
        .send({ email: 'a@b.com' })
        .expect(403);
      expect(verificationMock.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/email/verify', () => {
    it('remains publicly accessible without authentication', async () => {
      const response = await http()
        .get('/auth/email/verify')
        .query({ token: 'raw-token-value', id: 'u1' })
        .expect(200);
      expect(verificationMock.verifyToken).toHaveBeenCalledWith(
        'u1',
        'raw-token-value',
      );
      expect(response.body).toEqual({ success: true });
    });
  });

  describe('POST /auth/email/forgot-password', () => {
    it('remains publicly accessible without authentication', async () => {
      const response = await http()
        .post('/auth/email/forgot-password')
        .send({ email: 'a@b.com' })
        .expect(201);
      expect((response.body as { success: boolean }).success).toBe(true);
      expect(usersRepoMock.update).toHaveBeenCalled();
    });

    it('rejects a malformed email', async () => {
      await http()
        .post('/auth/email/forgot-password')
        .send({ email: 'bad' })
        .expect(400);
      expect(usersRepoMock.update).not.toHaveBeenCalled();
    });

    it('responds generically for unknown emails without writing tokens', async () => {
      usersServiceMock.findByEmail.mockResolvedValueOnce(null);
      const response = await http()
        .post('/auth/email/forgot-password')
        .send({ email: 'ghost@b.com' })
        .expect(201);
      expect((response.body as { message: string }).message).toContain(
        'If the email exists',
      );
      expect(usersRepoMock.update).not.toHaveBeenCalled();
    });

    it('does not leak the raw reset token in the response', async () => {
      const response = await http()
        .post('/auth/email/forgot-password')
        .send({ email: 'a@b.com' })
        .expect(201);
      expect(JSON.stringify(response.body)).not.toContain('token');
      expect(JSON.stringify(response.body)).not.toContain('password_reset');
    });

    it('is not blocked by the send/resend rate limiter (public flow)', async () => {
      rateLimitGuard.allowed = false;
      await http()
        .post('/auth/email/forgot-password')
        .send({ email: 'a@b.com' })
        .expect(201);
    });
  });
});
