import { Controller, Get, Logger, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { GithubAuthService } from '../services/github-auth.service';
import { extractAuthRequestContext } from '../services/device-info';
import {
  MOBILE_AUTH_REDIRECT_URI,
  validateMobileRedirectUri,
  validateOAuthDeviceId,
} from '../services/oauth-mobile-redirect';

@ApiTags('Authentication')
@Controller('auth')
export class GithubOauthController {
  private readonly logger = new Logger(GithubOauthController.name);

  constructor(private readonly githubAuthService: GithubAuthService) {}

  @Get('github/redirect')
  @ApiOperation({ summary: 'Redirect directly to GitHub OAuth' })
  @ApiResponse({ status: 302 })
  async githubLoginRedirect(
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
      url = await this.githubAuthService.getLoginUrl(
        mobileRedirectUri ?? undefined,
        deviceId,
      );
    } catch (error) {
      this.logger.error(
        'Failed to prepare the GitHub OAuth redirect.',
        error instanceof Error ? (error.stack ?? error.message) : String(error),
      );
      const webBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.FRONTEND_URL ??
        process.env.CLIENT_URL ??
        'http://localhost:3000'
      ).replace(/\/+$/, '');
      const failureUrl = mobileRedirectUri
        ? `${MOBILE_AUTH_REDIRECT_URI}?oauth_error=github_auth_failed`
        : `${webBaseUrl}/login?oauth_error=github_auth_failed`;
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, failureUrl);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
  }

  @Get('github')
  @ApiOperation({ summary: 'Prepare GitHub OAuth redirect' })
  @ApiResponse({ status: 200 })
  async githubLogin(
    @Query('redirectUri') redirectUri?: string,
    @Req() req?: Request,
  ) {
    try {
      return {
        success: true,
        url: await this.githubAuthService.getLoginUrl(
          redirectUri,
          req ? extractAuthRequestContext(req).deviceId : null,
        ),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'GitHub OAuth is not configured yet.';
      throw ErrorService.create(ErrorCode.INVALID_INPUT, message);
    }
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'Handle GitHub OAuth callback' })
  @ApiResponse({ status: 302 })
  async githubCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    let failureRedirectUrl =
      this.githubAuthService.handleGithubCallbackError().redirectUrl;
    try {
      failureRedirectUrl =
        await this.githubAuthService.getCallbackFailureRedirectUrl(state);
      const result = await this.githubAuthService.handleGithubCallback({
        code,
        state,
        context: extractAuthRequestContext(req),
      });

      return res.redirect(result.redirectUrl);
    } catch {
      return res.redirect(failureRedirectUrl);
    }
  }
}
