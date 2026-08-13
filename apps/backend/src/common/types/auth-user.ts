export interface AuthUser {
  sub: string;
  jti?: string;
  sessionId?: string;
  role?: string;
  email?: string;
}
