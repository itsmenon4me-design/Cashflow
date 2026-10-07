import type { Request, Response } from 'express';
import { GithubOauthController } from './github-oauth.controller';
import { GithubAuthService } from '../services/github-auth.service';

describe('GithubOauthController', () => {
  it('redirects to the prepared provider URL and preserves the native device ID', async () => {
    const service = {
      getLoginUrl: jest
        .fn()
        .mockResolvedValue('https://github.com/login/oauth/authorize'),
    };
    const controller = new GithubOauthController(
      service as unknown as GithubAuthService,
    );
    const req = { headers: {} } as Request;
    const setHeader = jest.fn();
    const redirect = jest.fn();
    const res = {
      setHeader,
      redirect,
    } as unknown as Response;
    const deviceId = '123e4567-e89b-42d3-a456-426614174000';

    await controller.githubLoginRedirect(
      'neraca://auth/callback',
      deviceId,
      req,
      res,
    );

    expect(service.getLoginUrl.mock.calls[0]).toEqual([
      'neraca://auth/callback',
      deviceId,
    ]);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(redirect).toHaveBeenCalledWith(
      302,
      'https://github.com/login/oauth/authorize',
    );
  });

  it('returns OAuth preparation failures to the native callback', async () => {
    const service = {
      getLoginUrl: jest
        .fn()
        .mockRejectedValue(new Error('provider unavailable')),
    };
    const controller = new GithubOauthController(
      service as unknown as GithubAuthService,
    );
    const req = { headers: {} } as Request;
    const redirect = jest.fn();
    const res = {
      setHeader: jest.fn(),
      redirect,
    } as unknown as Response;

    await controller.githubLoginRedirect(
      'neraca://auth/callback',
      undefined,
      req,
      res,
    );

    expect(redirect).toHaveBeenCalledWith(
      302,
      'neraca://auth/callback?oauth_error=github_auth_failed',
    );
  });
});
