import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { JwtConfig } from './jwt.config';

@Injectable()
export class JwtConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): JwtConfig {
    return this.configService.getOrThrow<Configuration, 'jwt'>('jwt', {
      infer: true,
    });
  }
}
