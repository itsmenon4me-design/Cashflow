import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  ttlSeconds: number;
}

export const redisConfig = registerAs<RedisConfig>('redis', () => ({
  url: process.env.REDIS_URL ?? '',
  ttlSeconds: Number.parseInt(process.env.REDIS_TTL_SECONDS ?? '60', 10),
}));
