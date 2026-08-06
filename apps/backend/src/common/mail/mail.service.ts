import { Injectable, Logger } from '@nestjs/common';
import { MailConfigService } from '../../config/mail-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  constructor(private readonly cfg: MailConfigService) {}

  sendVerification(email: string, name: string | undefined, link: string) {
    if (!this.cfg.config.emailVerificationEnabled) {
      this.logger.debug('Email verification disabled, skipping send');
      return;
    }

    // No external mailer configured in this environment. Log the email for now.
    this.logger.log(
      `(EMAIL) To=${email} Subject=Verify your email Link=${link}`,
    );
    this.logger.log(`Verification Sent: email=${email}`);
  }

  sendPasswordReset(email: string, name: string | undefined, link: string) {
    if (!this.cfg.config.passwordResetEnabled) {
      this.logger.debug('Password reset disabled, skipping send');
      return;
    }

    this.logger.log(`(EMAIL) To=${email} Subject=Password reset Link=${link}`);
    this.logger.log(`Password Reset Requested: email=${email}`);
  }
}
