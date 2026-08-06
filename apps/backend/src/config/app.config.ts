import { registerAs } from '@nestjs/config';
import { Environment } from './env.validation';
import type { CorsConfig } from './cors.config';
import type { DatabaseConfig } from './database.config';
import type { JwtConfig } from './jwt.config';
import type { RedisConfig } from './redis.config';
import type { SecurityConfig } from './security.config';
import type { SwaggerConfig } from './swagger.config';

export interface AppConfig {
  environment: Environment;
  name: string;
  port: number;
  url: string;
  prefix: string;
  version: string;
  timezone: string;
  locale: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  swagger: SwaggerConfig;
  security: SecurityConfig;
}

export const appConfig = registerAs<AppConfig>('app', () => ({
  environment: (process.env.NODE_ENV as Environment) ?? Environment.Development,
  name: process.env.APP_NAME ?? 'CashFlow Enterprise',
  port: Number.parseInt(process.env.APP_PORT ?? process.env.PORT ?? '3001', 10),
  url: process.env.APP_URL ?? 'http://localhost:3001',
  prefix: process.env.API_PREFIX ?? 'api',
  version: process.env.API_VERSION ?? 'v1',
  timezone: process.env.TZ ?? 'Asia/Jakarta',
  locale: process.env.APP_LOCALE ?? 'id-ID',
}));
