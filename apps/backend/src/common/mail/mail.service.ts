import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailConfigService } from '../../config/mail-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly cfg: MailConfigService) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const c = this.cfg.config;
      this.transporter = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465,
        auth: { user: c.user, pass: c.password },
      });
    }
    return this.transporter;
  }

  private async send(to: string, subject: string, html: string) {
    const c = this.cfg.config;
    try {
      await this.getTransporter().sendMail({
        from: c.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent successfully: to=${to} subject=${subject}`);
    } catch (err) {
      this.logger.error(
        `Failed to send email via SMTP: to=${to} subject=${subject} error=${(err as Error).message}`,
      );
      throw err;
    }
  }

  async sendVerification(
    email: string,
    name: string | undefined,
    link: string,
  ) {
    this.logger.log(`mail.sendVerification called: to=${email}`);
    if (!this.cfg.config.emailVerificationEnabled) {
      this.logger.warn(
        `Email verification disabled. Verification email for to=${email} not sent.`,
      );
      return;
    }
    if (this.cfg.config.smtpConfigured) {
      await this.send(
        email,
        'Verify your email',
        `<p>Hi ${name ?? ''},</p><p>Click the link below to verify your email:</p><p><a href="${link}">${link}</a></p>`,
      );
      return;
    }
    const error = new Error('SMTP not configured');
    this.logger.error(
      `SMTP not configured (SMTP_HOST missing). Email verification for to=${email} not sent.`,
    );
    throw error;
  }

  async sendPasswordReset(
    email: string,
    name: string | undefined,
    link: string,
  ) {
    if (!this.cfg.config.passwordResetEnabled) {
      this.logger.warn(
        `Password reset disabled. Password reset email for to=${email} not sent.`,
      );
      return;
    }
    if (this.cfg.config.smtpConfigured) {
      await this.send(
        email,
        'Password reset',
        `<p>Hi ${name ?? ''},</p><p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`,
      );
      return;
    }
    const error = new Error('SMTP not configured');
    this.logger.error(
      `SMTP not configured (SMTP_HOST missing). Password reset email for to=${email} not sent.`,
    );
    throw error;
  }
}
