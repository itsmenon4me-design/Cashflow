import { registerAs } from '@nestjs/config';

export interface CorsConfig {
  origin: string[];
  credentials: boolean;
  methods: string[];
}

/**
 * Single source of truth for CORS origins: CORS_ORIGINS (comma-separated).
 * CORS_ORIGIN is kept as a legacy fallback for backward compatibility.
 * A wildcard ("*") is never allowed. When no origin is configured, CORS is
 * disabled (main.ts maps an empty list to `origin: false`).
 */
function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry !== '*');
}

const localDevelopmentOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
];

export const corsConfig = registerAs<CorsConfig>('cors', () => {
  const configuredOrigins = parseOrigins(
    process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN,
  );

  // Keep local auth flows working without requiring a manual .env change.
  // This is intentionally restricted to non-production, non-test development.
  const environment = (process.env.NODE_ENV ?? '').toLowerCase();
  const origin =
    configuredOrigins.length > 0
      ? configuredOrigins
      : environment === 'production'
        ? []
        : localDevelopmentOrigins;

  return {
    origin,
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  };
});
