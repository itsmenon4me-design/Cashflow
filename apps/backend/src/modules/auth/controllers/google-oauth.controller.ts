import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { AuthRateLimitGuard } from '../auth-rate-limit.guard';
import { GoogleAuthService } from '../services/google-auth.service';
import { extractAuthRequestContext } from '../services/device-info';
import {
  MOBILE_AUTH_REDIRECT_URI,
  validateMobileRedirectUri,
  validateOAuthDeviceId,
} from '../services/oauth-mobile-redirect';

@ApiTags('Authentication')
@Controller('auth')
export class GoogleOauthController {
  private readonly logger = new Logger(GoogleOauthController.name);

  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Post('google/native')
  @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Sign in to the native app with a Google account' })
  @ApiResponse({ status: 200 })
  async googleNativeLogin(
    @Body() body: { accessToken?: string } | undefined,
    @Req() req: Request,
  ) {
    return this.googleAuthService.handleNativeSignIn(
      body?.accessToken,
      extractAuthRequestContext(req),
    );
  }

  @Get('google/redirect')
  @ApiOperation({ summary: 'Redirect directly to Google OAuth' })
  @ApiResponse({ status: 302 })
  async googleLoginRedirect(
    @Query('redirectUri') redirectUri: string | undefined,
    @Query('deviceId') requestedDeviceId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const mobileRedirectUri = validateMobileRedirectUri(redirectUri);
    const requestedDeviceIdValue = validateOAuthDeviceId(requestedDeviceId);
    const deviceId =
      extractAuthRequestContext(req).deviceId ?? requestedDeviceIdValue;

    let url: string;
    try {
      url = await this.googleAuthService.getLoginUrl(
        mobileRedirectUri ?? undefined,
        deviceId,
      );
    } catch (error) {
      this.logger.error(
        'Failed to prepare the Google OAuth redirect.',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      const webBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.FRONTEND_URL ??
        process.env.CLIENT_URL ??
        'http://localhost:3000'
      ).replace(/\/+$/, '');
      const failureUrl = mobileRedirectUri
        ? `${MOBILE_AUTH_REDIRECT_URI}?oauth_error=google_auth_failed`
        : `${webBaseUrl}/login?oauth_error=google_auth_failed`;
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, failureUrl);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
  }

  @Get('google')
  @ApiOperation({ summary: 'Prepare Google OAuth redirect' })
  @ApiResponse({ status: 200 })
  async googleLogin(
    @Query('redirectUri') redirectUri?: string,
    @Req() req?: Request,
  ) {
    try {
      return {
        success: true,
        url: await this.googleAuthService.getLoginUrl(
          redirectUri,
          req ? extractAuthRequestContext(req).deviceId : null,
        ),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Google OAuth is not configured yet.';
      throw ErrorService.create(ErrorCode.INVALID_INPUT, message);
    }
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiResponse({ status: 302 })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    let failureRedirectUrl =
      this.googleAuthService.handleGoogleCallbackError().redirectUrl;
    try {
      failureRedirectUrl =
        await this.googleAuthService.getCallbackFailureRedirectUrl(state);
      // Use raw code value provided by Express (query params are already decoded)
      const result = await this.googleAuthService.handleGoogleCallback({
        code,
        state,
        context: extractAuthRequestContext(req),
      });

      return res.redirect(result.redirectUrl);
    } catch (error) {
      this.logger.error(
        'Google OAuth callback handler failed.',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      return res.redirect(failureRedirectUrl);
    }
  }
}
