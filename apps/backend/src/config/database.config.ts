import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  schema: string;
  logging: boolean;
}

export const databaseConfig = registerAs<DatabaseConfig>('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  schema: process.env.DATABASE_SCHEMA ?? 'public',
  logging: process.env.DATABASE_LOGGING === 'true',
}));
