import type { Request, Response } from 'express';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleAuthService } from '../services/google-auth.service';

describe('GoogleOauthController', () => {
  it('redirects to the prepared provider URL and preserves the native device ID', async () => {
    const service = {
      getLoginUrl: jest
        .fn()
        .mockResolvedValue('https://accounts.google.com/oauth'),
    };
    const controller = new GoogleOauthController(
      service as unknown as GoogleAuthService,
    );
    const req = { headers: {} } as Request;
    const setHeader = jest.fn();
    const redirect = jest.fn();
    const res = {
      setHeader,
      redirect,
    } as unknown as Response;
    const deviceId = '123e4567-e89b-42d3-a456-426614174000';

    await controller.googleLoginRedirect(
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
      'https://accounts.google.com/oauth',
    );
  });

  it('returns OAuth preparation failures to the native callback', async () => {
    const service = {
      getLoginUrl: jest
        .fn()
        .mockRejectedValue(new Error('provider unavailable')),
    };
    const controller = new GoogleOauthController(
      service as unknown as GoogleAuthService,
    );
    const req = { headers: {} } as Request;
    const redirect = jest.fn();
    const res = {
      setHeader: jest.fn(),
      redirect,
    } as unknown as Response;

    await controller.googleLoginRedirect(
      'neraca://auth/callback',
      undefined,
      req,
      res,
    );

    expect(redirect).toHaveBeenCalledWith(
      302,
      'neraca://auth/callback?oauth_error=google_auth_failed',
    );
  });
});
