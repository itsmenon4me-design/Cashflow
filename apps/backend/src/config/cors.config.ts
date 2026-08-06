import { registerAs } from '@nestjs/config';

export interface CorsConfig {
  origin: string[];
  credentials: boolean;
  methods: string[];
}

export const corsConfig = registerAs<CorsConfig>('cors', () => ({
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0),
  credentials: process.env.CORS_CREDENTIALS !== 'false',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
}));
