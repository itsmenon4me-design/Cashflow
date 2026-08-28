import { EmailVerificationService } from './email-verification.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../../common/mail/mail.service';
import { MailConfigService } from '../../../config/mail-config.service';
import { PrismaUsersRepository } from '../../users/repositories/prisma-users.repository';
import { UserEntity } from '../../users/entities/user.entity';

describe('EmailVerificationService', () => {
  let svc: EmailVerificationService;
  let users: Partial<UsersService> & { findById: jest.Mock };
  let mail: Partial<MailService> & { sendVerification: jest.Mock };
  let mailCfg: Partial<MailConfigService>;
  let usersRepo: Partial<PrismaUsersRepository> & { update: jest.Mock };

  beforeEach(() => {
    users = {
      findById: jest.fn(),
    };
    mail = {
      sendVerification: jest.fn().mockResolvedValue(undefined),
    };
    mailCfg = {
      config: {
        emailVerificationEnabled: true,
        host: '',
        port: 587,
        from: '',
        passwordResetEnabled: true,
        smtpConfigured: false,
      },
    };

    usersRepo = {
      update: jest.fn(),
    };

    svc = new EmailVerificationService(
      users as unknown as UsersService,
      mail as unknown as MailService,
      mailCfg as MailConfigService,
      usersRepo as unknown as PrismaUsersRepository,
    );
  });

  it('generates and stores token hash on send', async () => {
    const user = new UserEntity();
    user.id = 'u1';
    user.email = 'a@b.com';
    user.full_name = 'Test';
    user.username = 't';
    user.password_hash = 'x';
    user.created_at = new Date();
    user.updated_at = new Date();
    user.status = 'PENDING_VERIFICATION';

    (users.findById as jest.Mock).mockResolvedValue(user);

    await svc.sendVerificationEmail('u1');

    expect(usersRepo.update).toHaveBeenCalled();
    expect(mail.sendVerification).toHaveBeenCalledWith(
      'a@b.com',
      'Test',
      expect.any(String),
    );
  });

  it('waits for and propagates email delivery failures', async () => {
    const user = new UserEntity();
    user.id = 'u1';
    user.email = 'a@b.com';
    user.full_name = 'Test';
    user.username = 't';
    user.password_hash = 'x';
    user.created_at = new Date();
    user.updated_at = new Date();
    user.status = 'PENDING_VERIFICATION';
    (users.findById as jest.Mock).mockResolvedValue(user);
    (mail.sendVerification as jest.Mock).mockRejectedValue(
      new Error('SMTP unavailable'),
    );

    await expect(svc.sendVerificationEmail('u1')).rejects.toThrow(
      'SMTP unavailable',
    );
  });
});
