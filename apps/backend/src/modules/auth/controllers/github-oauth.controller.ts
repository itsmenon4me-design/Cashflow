import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ErrorService } from '../../../common/errors/error.service';
import { GithubAuthService } from '../services/github-auth.service';
import { extractAuthRequestContext } from '../services/device-info';

@ApiTags('Authentication')
@Controller('auth')
export class GithubOauthController {
  constructor(private readonly githubAuthService: GithubAuthService) {}

  @Get('github')
  @ApiOperation({ summary: 'Prepare GitHub OAuth redirect' })
  @ApiResponse({ status: 200 })
  async githubLogin() {
    try {
      return {
        success: true,
        url: this.githubAuthService.getLoginUrl(),
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
    try {
      const result = await this.githubAuthService.handleGithubCallback({
        code,
        state,
        context: extractAuthRequestContext(req),
      });

      return res.redirect(result.redirectUrl);
    } catch {
      const fallback = this.githubAuthService.handleGithubCallbackError();
      return res.redirect(fallback.redirectUrl);
    }
  }
}
