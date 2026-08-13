import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as IORedisClient, RedisOptions } from 'ioredis';
import { RedisConfig } from './redis.interfaces';
import { REDIS_DEFAULT_DB, REDIS_DEFAULT_PORT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: IORedisClient | null = null;
  private config: RedisConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.readConfig();
  }

  onModuleInit(): void {
    // Try to connect but do not fail the app if Redis is down
    this.connect().catch((err) => {
      this.logger.error(
        'Redis initial connect failed: ' + this.formatError(err),
      );
    });
  }

  onModuleDestroy(): void {
    // best-effort disconnect
    this.disconnect().catch((err) => {
      this.logger.error(
        'Error while disconnecting Redis: ' + this.formatError(err),
      );
    });
  }

  private readConfig(): RedisConfig {
    const host = this.configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = Number(
      this.configService.get<number>('REDIS_PORT', REDIS_DEFAULT_PORT),
    );
    const username = this.configService.get<string | undefined>(
      'REDIS_USERNAME',
    );
    const password = this.configService.get<string | undefined>(
      'REDIS_PASSWORD',
    );
    const db = Number(
      this.configService.get<number>('REDIS_DB', REDIS_DEFAULT_DB),
    );
    const tlsRaw = this.configService.get<string | undefined>('REDIS_TLS');
    const tls = tlsRaw === 'true' || tlsRaw === '1';
    const keyPrefix = this.configService.get<string | undefined>(
      'REDIS_KEY_PREFIX',
    );

    return { host, port, username, password, db, tls, keyPrefix };
  }

  async connect(): Promise<void> {
    if (this.client) {
      if (this.client.status === 'ready') return;
      // if client exists but not ready, attempt to quit and recreate
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
      this.client = null;
    }

    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port ?? REDIS_DEFAULT_PORT,
      username: this.config.username,
      password: this.config.password,
      db: this.config.db ?? REDIS_DEFAULT_DB,
      // ioredis will handle reconnection with this retryStrategy
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(
          `Redis reconnect attempt #${times}, retrying in ${delay}ms`,
        );
        return delay;
      },
      // enable keyPrefix if provided
      keyPrefix: this.config.keyPrefix,
    };

    if (this.config.tls) {
      // minimal TLS enablement: allow self-signed if necessary; production should be stricter
      Reflect.set(options, 'tls', {});
    }

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.logger.log('Redis connecting...');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('end', () => {
      this.logger.log('Redis disconnected');
    });

    this.client.on('reconnecting', (delay: number) => {
      this.logger.warn(`Redis reconnecting, next attempt in ${delay}ms`);
    });

    this.client.on('error', (err: unknown) => {
      this.logger.error('Redis connection error: ' + this.formatError(err));
    });

    // wait until ready or timeout (only await if connect() returns a promise)
    try {
      const clientAs = this.client as unknown as { connect?: () => unknown };
      const maybe = clientAs.connect ? clientAs.connect() : undefined;
      if (maybe != null) {
        const thenProp = (maybe as unknown as Record<string, unknown>)['then'];
        if (typeof thenProp === 'function') {
          await (maybe as Promise<unknown>);
        }
      }
    } catch (err) {
      // ioredis connect may throw in some versions; log and let retry strategy handle reconnection
      this.logger.warn(
        'Redis connect() failed (non-fatal), continuing without a ready client: ' +
          this.formatError(err),
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return undefined;
    try {
      const clientAsQuit = this.client as unknown as { quit?: () => unknown };
      const maybeQuit = clientAsQuit.quit ? clientAsQuit.quit() : undefined;
      if (maybeQuit != null) {
        const thenProp = (maybeQuit as unknown as Record<string, unknown>)[
          'then'
        ];
        if (typeof thenProp === 'function') {
          await (maybeQuit as Promise<unknown>);
        }
      }
      this.logger.log('Redis client quit');
    } catch (err) {
      this.logger.warn(
        'Redis quit failed, attempting disconnect: ' + this.formatError(err),
      );
      try {
        const clientAsDisc = this.client as unknown as {
          disconnect?: () => unknown;
        };
        const maybeDisc = clientAsDisc.disconnect
          ? clientAsDisc.disconnect()
          : undefined;
        if (maybeDisc != null) {
          const thenProp = (maybeDisc as unknown as Record<string, unknown>)[
            'then'
          ];
          if (typeof thenProp === 'function') {
            await (maybeDisc as Promise<unknown>);
          }
        }
        this.logger.log('Redis client disconnected');
      } catch (e) {
        this.logger.error('Redis disconnect failed: ' + this.formatError(e));
      }
    }
    this.client = null;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) return err.stack ?? err.message;
    try {
      return String(err);
    } catch {
      return 'Unknown error';
    }
  }

  private ensureClient(): IORedisClient | null {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return null;
    }
    if (this.client.status !== 'ready') {
      this.logger.warn(`Redis client not ready (status=${this.client.status})`);
      return this.client;
    }
    return this.client;
  }

  // Health check
  async ping(): Promise<boolean> {
    const c = this.ensureClient();
    if (!c) return false;
    try {
      const res = await c.ping();
      // `ping` might return either 'PONG' or 'OK' depending on client/server; normalize check
      return (
        typeof res === 'string' &&
        (res.toUpperCase() === 'PONG' || res.toUpperCase() === 'OK')
      );
    } catch (err) {
      this.logger.warn('Redis ping failed: ' + this.formatError(err));
      return false;
    }
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    const c = this.ensureClient();
    if (!c) return null;
    try {
      return await c.get(key);
    } catch (err) {
      this.logger.warn(
        `Redis GET failed for key=${key}: ` + this.formatError(err),
      );
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const c = this.ensureClient();
    if (!c) return false;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await c.set(key, value, 'EX', ttlSeconds);
      } else {
        await c.set(key, value);
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Redis SET failed for key=${key}: ` + this.formatError(err),
      );
      return false;
    }
  }

  /**
   * Atomic increment with optional TTL set on first creation.
   * Returns the new numeric value, or null if Redis is unavailable or error occurs.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number | null> {
    const c = this.ensureClient();
    if (!c) return null;
    try {
      const newVal = await c.incr(key);
      // If this is the first increment, ensure the TTL is set so the counter expires
      if (ttlSeconds && newVal === 1) {
        try {
          await c.expire(key, ttlSeconds);
        } catch (err) {
          // best-effort
          this.logger.warn(
            `Redis EXPIRE failed while setting ttl for key=${key}: ` +
              this.formatError(err),
          );
        }
      }
      return typeof newVal === 'number' ? newVal : parseInt(String(newVal), 10);
    } catch (err) {
      this.logger.warn(
        `Redis INCR failed for key=${key}: ` + this.formatError(err),
      );
      return null;
    }
  }

  async del(key: string): Promise<number> {
    const c = this.ensureClient();
    if (!c) return 0;
    try {
      return await c.del(key);
    } catch (err) {
      this.logger.warn(
        `Redis DEL failed for key=${key}: ` + this.formatError(err),
      );
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    const c = this.ensureClient();
    if (!c) return false;
    try {
      const res = await c.exists(key);
      return res > 0;
    } catch (err) {
      this.logger.warn(
        `Redis EXISTS failed for key=${key}: ` + this.formatError(err),
      );
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const c = this.ensureClient();
    if (!c) return false;
    try {
      const res = await c.expire(key, seconds);
      return res === 1;
    } catch (err) {
      this.logger.warn(
        `Redis EXPIRE failed for key=${key}: ` + this.formatError(err),
      );
      return false;
    }
  }

  async ttl(key: string): Promise<number | null> {
    const c = this.ensureClient();
    if (!c) return null;
    try {
      const res = await c.ttl(key);
      return res;
    } catch (err) {
      this.logger.warn(
        `Redis TTL failed for key=${key}: ` + this.formatError(err),
      );
      return null;
    }
  }

  // Only allow flushdb in non-production environments
  async flushdb(): Promise<boolean> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      this.logger.warn('flushdb called in production — operation is blocked');
      return false;
    }
    const c = this.ensureClient();
    if (!c) return false;
    try {
      await c.flushdb();
      this.logger.warn('Redis FLUSHDB executed (non-production)');
      return true;
    } catch (err) {
      this.logger.warn('Redis FLUSHDB failed: ' + this.formatError(err));
      return false;
    }
  }
}
