import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { AppleAuthService } from '../services/apple-auth.service';
import { extractAuthRequestContext } from '../services/device-info';

@ApiTags('Authentication')
@Controller('auth')
export class AppleOauthController {
  constructor(private readonly appleAuthService: AppleAuthService) {}

  @Get('apple')
  @ApiOperation({ summary: 'Prepare Apple OAuth redirect' })
  @ApiResponse({ status: 200 })
  async appleLogin() {
    try {
      return {
        success: true,
        url: this.appleAuthService.getLoginUrl(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Apple OAuth is not configured yet.';
      throw ErrorService.create(ErrorCode.INVALID_INPUT, message);
    }
  }

  @Get('apple/callback')
  @ApiOperation({ summary: 'Handle Apple OAuth callback' })
  @ApiResponse({ status: 302 })
  async appleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    try {
      const result = await this.appleAuthService.handleAppleCallback({
        code,
        state,
        context: extractAuthRequestContext(req),
      });

      return res.redirect(result.redirectUrl);
    } catch (error) {
      const fallback = await this.appleAuthService.handleAppleCallbackError();
      return res.redirect(fallback.redirectUrl);
    }
  }
}
