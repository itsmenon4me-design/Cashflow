import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { CorsConfig } from './cors.config';

@Injectable()
export class CorsConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): CorsConfig {
    return this.configService.getOrThrow<Configuration, 'cors'>('cors', {
      infer: true,
    });
  }
}
