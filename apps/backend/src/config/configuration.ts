import { Environment } from './env.validation';

export interface AppConfig {
  environment: Environment;
  host: string;
  port: number;
  prefix: string;
  version: string;
  corsOrigins: string[];
}

export interface Configuration {
  app: AppConfig;
}

export function configuration(): Configuration {
  return {
    app: {
      environment:
        (process.env.NODE_ENV as Environment) ?? Environment.Development,
      host: process.env.HOST ?? '0.0.0.0',
      port: parseInt(process.env.PORT ?? '3000', 10),
      prefix: process.env.API_PREFIX ?? 'api',
      version: process.env.API_VERSION ?? 'v1',
      corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
  };
}
