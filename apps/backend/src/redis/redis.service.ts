import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
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
    const configuredHost = process.env.REDIS_HOST?.trim();
    const url = configuredHost ? undefined : process.env.REDIS_URL;
    const host = configuredHost || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || REDIS_DEFAULT_PORT);
    const configuredUsername = process.env.REDIS_USERNAME;
    const password = process.env.REDIS_PASSWORD;
    const db = Number(process.env.REDIS_DB || REDIS_DEFAULT_DB);
    const tlsRaw = process.env.REDIS_TLS;
    const tls = tlsRaw === 'true' || tlsRaw === '1';
    const keyPrefix = process.env.REDIS_KEY_PREFIX;

    return {
      url: url || undefined,
      host,
      port,
      username: configuredUsername || undefined,
      password,
      db,
      tls,
      keyPrefix,
    };
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

    let connectionUrl: string | undefined;
    let host = this.config.host;
    let port = this.config.port ?? REDIS_DEFAULT_PORT;
    let username = this.config.username;
    let password = this.config.password;
    let db = this.config.db ?? REDIS_DEFAULT_DB;
    let tls = this.config.tls === true;

    if (this.config.url) {
      try {
        const parsedUrl = new URL(this.config.url);
        if (
          parsedUrl.protocol !== 'redis:' &&
          parsedUrl.protocol !== 'rediss:'
        ) {
          throw new Error(`unsupported protocol ${parsedUrl.protocol}`);
        }
        connectionUrl = this.config.url;
        host = parsedUrl.hostname;
        port = parsedUrl.port ? Number(parsedUrl.port) : REDIS_DEFAULT_PORT;
        username = parsedUrl.username || username;
        password = parsedUrl.password || password;
        db =
          parsedUrl.pathname.length > 1
            ? Number(parsedUrl.pathname.slice(1))
            : db;
        tls = parsedUrl.protocol === 'rediss:' || tls;
      } catch (err) {
        this.logger.error(
          'Invalid REDIS_URL configuration: ' + this.formatError(err),
        );
        throw err;
      }
    }

    if (tls && password && !username) {
      username = 'default';
    }

    const options: RedisOptions = {
      host,
      port,
      username,
      password,
      db,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
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

    if (tls) {
      options.tls = {
        servername: host,
        rejectUnauthorized: true,
      };
    }

    this.logger.log(
      `Redis configuring host=${host ?? 'unknown'} port=${port} tls=${tls} ` +
        `username=${username ? 'configured' : 'unset'} source=${connectionUrl ? 'url' : 'parts'}`,
    );

    this.client = connectionUrl
      ? new Redis(connectionUrl, options)
      : new Redis({ ...options, host });

    this.client.on('connect', () => {
      this.logger.log(`Redis socket connected to ${host}:${port} (tls=${tls})`);
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
      this.logger.error(
        `Redis connection error host=${host}:${port} tls=${tls}: ` +
          this.formatError(err),
      );
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

  getDebugConfig(): { host: string; port: number; tls: boolean } {
    if (this.config.url) {
      try {
        const parsedUrl = new URL(this.config.url);
        return {
          host: parsedUrl.hostname,
          port: parsedUrl.port ? Number(parsedUrl.port) : REDIS_DEFAULT_PORT,
          tls: parsedUrl.protocol === 'rediss:' || this.config.tls === true,
        };
      } catch {
        // The connection check reports the invalid URL; keep this response safe.
      }
    }

    return {
      host: this.config.host ?? '127.0.0.1',
      port: this.config.port ?? REDIS_DEFAULT_PORT,
      tls: this.config.tls === true,
    };
  }

  async debugCheck(): Promise<
    | {
        status: 'connected';
        configUsed: { host: string; port: number; tls: boolean };
      }
    | {
        status: 'failed';
        configUsed: { host: string; port: number; tls: boolean };
        errorMessage: string;
        errorCode?: string;
      }
  > {
    const configUsed = this.getDebugConfig();
    const c = this.ensureClient();

    if (!c) {
      return {
        status: 'failed',
        configUsed,
        errorMessage: 'Redis client is not initialized.',
      };
    }

    try {
      await this.withTimeout(c.ping(), 6000);
      const key = `debug:redis-check:${crypto.randomUUID()}`;
      const value = crypto.randomUUID();
      await this.withTimeout(c.set(key, value, 'EX', 30), 6000);
      const storedValue = await this.withTimeout(c.get(key), 6000);
      await this.withTimeout(c.del(key), 6000);

      if (storedValue !== value) {
        throw new Error(
          'Redis SET/GET verification returned an unexpected value.',
        );
      }

      return { status: 'connected', configUsed };
    } catch (error) {
      const redisError = error as { message?: unknown; code?: unknown };
      return {
        status: 'failed',
        configUsed,
        errorMessage:
          typeof redisError.message === 'string'
            ? redisError.message.replace(
                /redis:\/\/[^\\s]+/gi,
                'redis://[redacted]',
              )
            : 'Redis check failed.',
        ...(typeof redisError.code === 'string'
          ? { errorCode: redisError.code }
          : {}),
      };
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () =>
          reject(new Error(`Redis operation timed out after ${timeoutMs}ms.`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
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
