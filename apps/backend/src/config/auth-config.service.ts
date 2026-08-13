import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { AuthConfig } from './auth.config';

@Injectable()
export class AuthConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): AuthConfig {
    return this.configService.getOrThrow<Configuration, 'auth'>('auth', {
      infer: true,
    });
  }
}
