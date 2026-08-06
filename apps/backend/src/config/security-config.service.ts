import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { SecurityConfig } from './security.config';

@Injectable()
export class SecurityConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): SecurityConfig {
    return this.configService.getOrThrow<Configuration, 'security'>(
      'security',
      {
        infer: true,
      },
    );
  }
}
