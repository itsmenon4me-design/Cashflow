export interface AuthRequestContext {
  ip?: string | null;
  userAgent?: string | null;
  clientPlatform?: 'android' | 'ios' | null;
  city?: string | null;
  country?: string | null;
  deviceId?: string | null;
}
