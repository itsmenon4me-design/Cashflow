import { EmailVerificationService } from './email-verification.service';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../../common/mail/mail.service';
import { MailConfigService } from '../../../config/mail-config.service';

describe('EmailVerificationService', () => {
  let svc: EmailVerificationService;
  let users: Partial<UsersService>;
  let mail: Partial<MailService>;
  let mailCfg: Partial<MailConfigService>;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;
    mail = {
      sendVerification: jest.fn(),
    } as any;
    mailCfg = {
      config: { emailVerificationEnabled: true, host: '', port: 587, from: '', passwordResetEnabled: true },
    } as any;

    svc = new EmailVerificationService(
      users as UsersService,
      mail as MailService,
      mailCfg as MailConfigService,
    );
  });

  it('generates and stores token hash on send', async () => {
    const user = { id: 'u1', email: 'a@b.com', full_name: 'Test' } as any;
    (users.findById as jest.Mock).mockResolvedValue(user);

    await svc.sendVerificationEmail('u1');

    expect(users.update).toHaveBeenCalled();
    expect(mail.sendVerification).toHaveBeenCalledWith('a@b.com', 'Test', expect.any(String));
  });
});
