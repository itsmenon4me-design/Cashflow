import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from './mail.config';

@Injectable()
export class MailConfigService {
  constructor(private readonly cfg: ConfigService) {}

  get config(): MailConfig {
    return this.cfg.get<MailConfig>('mail', { infer: true });
  }
}
