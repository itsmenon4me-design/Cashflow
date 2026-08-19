import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { GoogleAuthService } from '../services/google-auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class GoogleOauthController {
  constructor(private readonly googleAuthService: GoogleAuthService) {}

  @Get('google')
  @ApiOperation({ summary: 'Prepare Google OAuth redirect' })
  @ApiResponse({ status: 200 })
  async googleLogin() {
    try {
      return {
        success: true,
        url: this.googleAuthService.getLoginUrl(),
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
    try {
      const result = await this.googleAuthService.handleGoogleCallback({
        code,
        state,
      });

      return res.redirect(result.redirectUrl);
    } catch (error) {
      const fallback = await this.googleAuthService.handleGoogleCallbackError();
      return res.redirect(fallback.redirectUrl);
    }
  }
}
