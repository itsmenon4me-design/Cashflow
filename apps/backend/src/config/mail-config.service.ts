import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from './mail.config';

@Injectable()
export class MailConfigService {
  constructor(private readonly cfg: ConfigService) {}

  get config(): MailConfig {
    const raw = this.cfg.get<MailConfig>('mail');

    if (raw) {
      return raw;
    }

    return {
      host: '',
      port: 587,
      user: '',
      password: '',
      from: 'no-reply@cashflow.example.com',
      emailVerificationEnabled: false,
      passwordResetEnabled: true,
      smtpConfigured: false,
    };
  }
}
