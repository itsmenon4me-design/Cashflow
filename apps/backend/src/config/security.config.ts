import { registerAs } from '@nestjs/config';

export interface SecurityConfig {
  helmet: boolean;
  cors: boolean;
  rateLimit: {
    enabled: boolean;
    ttlSeconds: number;
    limit: number;
  };
  adminAuditRateLimit: {
    ttlSeconds: number;
    limit: number;
  };
  secureCookies: boolean;
  csrf: {
    enabled: boolean;
    statusCode: number;
  };
  // Should the Express app trust proxy headers (e.g., behind Nginx/Cloudflare)
  trustProxy: boolean;
}

export const securityConfig = registerAs<SecurityConfig>('security', () => ({
  helmet: process.env.SECURITY_HELMET !== 'false',
  cors: process.env.SECURITY_CORS !== 'false',
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    ttlSeconds: Number.parseInt(process.env.RATE_LIMIT_TTL_SECONDS ?? '60', 10),
    limit: Number.parseInt(process.env.RATE_LIMIT_LIMIT ?? '100', 10),
  },
  adminAuditRateLimit: {
    ttlSeconds: Number.parseInt(
      process.env.AUDIT_ADMIN_RATE_LIMIT_TTL_SECONDS ?? '60',
      10,
    ),
    limit: Number.parseInt(
      process.env.AUDIT_ADMIN_RATE_LIMIT_LIMIT ?? '120',
      10,
    ),
  },
  secureCookies: process.env.SECURE_COOKIES === 'true',
  csrf: {
    enabled: false,
    statusCode: 403,
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
}));
