import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { RedisConfig } from './redis.config';

@Injectable()
export class RedisConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): RedisConfig {
    return this.configService.getOrThrow<Configuration, 'redis'>('redis', {
      infer: true,
    });
  }
}
