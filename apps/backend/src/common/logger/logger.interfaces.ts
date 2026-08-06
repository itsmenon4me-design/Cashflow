export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export interface LogMeta {
  correlationId?: string;
  ip?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  statusCode?: number;
  responseTimeMs?: number;
  payloadSizeBytes?: number; // placeholder
  [key: string]: unknown;
}

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  meta?: LogMeta;
}
