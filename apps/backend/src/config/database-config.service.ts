import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { DatabaseConfig } from './database.config';

@Injectable()
export class DatabaseConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): DatabaseConfig {
    return this.configService.getOrThrow<Configuration, 'database'>(
      'database',
      {
        infer: true,
      },
    );
  }
}
