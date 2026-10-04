import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { GoogleAuthService } from '../services/google-auth.service';
import { extractAuthRequestContext } from '../services/device-info';

@ApiTags('Authentication')
@Controller('auth')
export class GoogleOauthController {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

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
        error instanceof Error ? error.message : 'Google OAuth is not configured yet.';
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
      // log original error message for debugging
      try { console.error('[GoogleOAuthController] callback handler error:', error?.message ?? error); } catch (e) { /* ignore */ }
      return res.redirect(failureRedirectUrl);
    }
  }
}
