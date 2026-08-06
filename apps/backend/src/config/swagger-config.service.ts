import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from './app.config';
import type { SwaggerConfig } from './swagger.config';

@Injectable()
export class SwaggerConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get config(): SwaggerConfig {
    return this.configService.getOrThrow<Configuration, 'swagger'>('swagger', {
      infer: true,
    });
  }
}
