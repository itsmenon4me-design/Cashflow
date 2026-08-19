import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  loginLimit: number;
  loginWindowSeconds: number;
  registerLimit: number;
  registerWindowSeconds: number;
  refreshLimit: number;
  refreshWindowSeconds: number;
  emailVerificationLimit: number;
  emailVerificationWindowSeconds: number;
  resetPasswordLimit: number;
  resetPasswordWindowSeconds: number;
  failLimit: number;
  failWindowSeconds: number;
}

export const authConfig = registerAs<AuthConfig>('auth', () => ({
  loginLimit: Number.parseInt(process.env.AUTH_LOGIN_LIMIT ?? '5', 10),
  loginWindowSeconds: Number.parseInt(
    process.env.AUTH_LOGIN_WINDOW_SECONDS ?? '60',
    10,
  ),
  registerLimit: Number.parseInt(process.env.AUTH_REGISTER_LIMIT ?? '10', 10),
  registerWindowSeconds: Number.parseInt(
    process.env.AUTH_REGISTER_WINDOW_SECONDS ?? '60',
    10,
  ),
  refreshLimit: Number.parseInt(process.env.AUTH_REFRESH_LIMIT ?? '30', 10),
  refreshWindowSeconds: Number.parseInt(
    process.env.AUTH_REFRESH_WINDOW_SECONDS ?? '60',
    10,
  ),
  emailVerificationLimit: Number.parseInt(
    process.env.AUTH_EMAIL_VERIFICATION_LIMIT ?? '10',
    10,
  ),
  emailVerificationWindowSeconds: Number.parseInt(
    process.env.AUTH_EMAIL_VERIFICATION_WINDOW_SECONDS ?? '60',
    10,
  ),
  resetPasswordLimit: Number.parseInt(
    process.env.AUTH_RESET_PASSWORD_LIMIT ?? '5',
    10,
  ),
  resetPasswordWindowSeconds: Number.parseInt(
    process.env.AUTH_RESET_PASSWORD_WINDOW_SECONDS ?? '60',
    10,
  ),
  failLimit: Number.parseInt(process.env.AUTH_FAIL_LIMIT ?? '10', 10),
  failWindowSeconds: Number.parseInt(
    process.env.AUTH_FAIL_WINDOW_SECONDS ?? '3600',
    10,
  ),
}));
