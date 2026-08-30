export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  username?: string | undefined;
  password?: string | undefined;
  db?: number;
  tls?: boolean;
  // optional prefix for keys
  keyPrefix?: string;
}
