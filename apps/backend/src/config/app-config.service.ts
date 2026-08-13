import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, Configuration } from './app.config';
import type { CorsConfig } from './cors.config';
import type { DatabaseConfig } from './database.config';
import type { JwtConfig } from './jwt.config';
import type { RedisConfig } from './redis.config';
import type { SecurityConfig } from './security.config';
import type { SwaggerConfig } from './swagger.config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Configuration>) {}

  get app(): AppConfig {
    return this.configService.getOrThrow<Configuration, 'app'>('app', {
      infer: true,
    });
  }

  get environment(): AppConfig['environment'] {
    return this.app.environment;
  }

  get name(): string {
    return this.app.name;
  }

  get port(): number {
    return this.app.port;
  }

  get host(): string {
    const host = process.env.HOST;
    if (host) {
      return host;
    }
    const appUrl = new URL(this.app.url);
    return appUrl.hostname;
  }

  get url(): string {
    return this.app.url;
  }

  get apiPrefix(): string {
    return this.app.prefix;
  }

  get apiVersion(): string {
    return this.app.version;
  }

  get timezone(): string {
    return this.app.timezone;
  }

  get locale(): string {
    return this.app.locale;
  }

  get database(): DatabaseConfig {
    return this.configService.getOrThrow<Configuration, 'database'>(
      'database',
      {
        infer: true,
      },
    );
  }

  get redis(): RedisConfig {
    return this.configService.getOrThrow<Configuration, 'redis'>('redis', {
      infer: true,
    });
  }

  get jwt(): JwtConfig {
    return this.configService.getOrThrow<Configuration, 'jwt'>('jwt', {
      infer: true,
    });
  }

  get cors(): CorsConfig {
    return this.configService.getOrThrow<Configuration, 'cors'>('cors', {
      infer: true,
    });
  }

  get swagger(): SwaggerConfig {
    return this.configService.getOrThrow<Configuration, 'swagger'>('swagger', {
      infer: true,
    });
  }

  get security(): SecurityConfig {
    return this.configService.getOrThrow<Configuration, 'security'>(
      'security',
      {
        infer: true,
      },
    );
  }

  get corsOrigins(): string[] {
    return this.cors.origin;
  }
}
