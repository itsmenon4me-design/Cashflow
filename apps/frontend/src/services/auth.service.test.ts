import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService, type RegisterPayload } from './auth.service';
import { apiClient } from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('auth.service', () => {
  beforeEach(() => {
    mockedApi.get.mockClear();
    mockedApi.post.mockClear();
  });

  it('requests the Google OAuth redirect URL', async () => {
    mockedApi.get.mockResolvedValue({ success: true, url: 'https://accounts.google.com/oauth2/auth' });

    const res = await authService.googleLogin();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/google');
    expect(res).toEqual({ success: true, url: 'https://accounts.google.com/oauth2/auth' });
  });

  it('requests the Apple OAuth redirect URL', async () => {
    mockedApi.get.mockResolvedValue({ success: true, url: 'https://appleid.apple.com/auth/authorize' });

    const res = await authService.appleLogin();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/apple');
    expect(res).toEqual({ success: true, url: 'https://appleid.apple.com/auth/authorize' });
  });

  it('register posts to /auth/register and returns payload', async () => {
    const payload: RegisterPayload = {
      email: 'user@example.com',
      username: 'user1',
      full_name: 'User One',
      password: 'VeryS3cureP@ss!'
    };

    const returned = { success: true, data: { id: 'u1', email: payload.email } };
    mockedApi.post.mockResolvedValue(returned);

    const res = await authService.register(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', payload);
    expect(res).toEqual(returned);
  });

  it('sendVerification posts to /auth/email/send-verification', async () => {
    mockedApi.post.mockResolvedValue({ success: true });
    const res = await authService.sendVerification('a@b.com');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/email/send-verification', { email: 'a@b.com' });
    expect(res).toEqual({ success: true });
  });

  it('forgotPassword posts to /auth/email/forgot-password', async () => {
    mockedApi.post.mockResolvedValue({ success: true, message: 'If the email exists...' });

    const res = await authService.forgotPassword('user@example.com');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/email/forgot-password', { email: 'user@example.com' });
    expect(res).toEqual({ success: true, message: 'If the email exists...' });
  });

  it('resetPassword posts to /auth/reset-password', async () => {
    mockedApi.post.mockResolvedValue({ success: true, message: 'Password has been reset successfully' });

    const res = await authService.resetPassword({
      token: 'a'.repeat(64),
      id: '4d2d4f19-90bb-42d7-8e57-2a3dd2a2d8e8',
      new_password: 'StrongPassword123',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'a'.repeat(64),
      id: '4d2d4f19-90bb-42d7-8e57-2a3dd2a2d8e8',
      new_password: 'StrongPassword123',
    });
    expect(res).toEqual({ success: true, message: 'Password has been reset successfully' });
  });
});
