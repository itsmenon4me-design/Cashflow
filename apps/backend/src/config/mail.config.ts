import { registerAs } from '@nestjs/config';

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  emailVerificationEnabled: boolean;
  passwordResetEnabled: boolean;
}

export const mailConfig = registerAs('mail', (): MailConfig => ({
  host: process.env.SMTP_HOST ?? '',
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  user: process.env.SMTP_USER ?? '',
  password: process.env.SMTP_PASSWORD ?? '',
  from: process.env.SMTP_FROM ?? 'no-reply@cashflow.example.com',
  emailVerificationEnabled:
    (process.env.EMAIL_VERIFICATION_ENABLED ?? 'false') === 'true',
  passwordResetEnabled:
    (process.env.PASSWORD_RESET_ENABLED ?? 'true') === 'true',
}));
