import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguageStore } from '@/stores/language.store';

const { mockGoogleLogin, mockAppleLogin } = vi.hoisted(() => ({
  mockGoogleLogin: vi.fn(),
  mockAppleLogin: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/services/auth.service', () => ({
  authService: {
    googleLogin: mockGoogleLogin,
    appleLogin: mockAppleLogin,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    sendVerification: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ loginSession: vi.fn() }),
}));

import Page from './page';

describe('Login page', () => {
  beforeEach(() => {
    mockGoogleLogin.mockReset();
    mockAppleLogin.mockReset();
    useLanguageStore.getState().setLanguage('en');
  });

  it('redirects to Google when Continue with Google is clicked', async () => {
    mockGoogleLogin.mockResolvedValue({ success: true, url: 'https://accounts.google.com/oauth2/auth' });
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));

    await waitFor(() => expect(mockGoogleLogin).toHaveBeenCalledTimes(1));
    expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/oauth2/auth');
  });

  it('redirects to Apple when Continue with Apple is clicked', async () => {
    mockAppleLogin.mockResolvedValue({ success: true, url: 'https://appleid.apple.com/auth/authorize' });
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Apple/i }));

    await waitFor(() => expect(mockAppleLogin).toHaveBeenCalledTimes(1));
    expect(assignSpy).toHaveBeenCalledWith('https://appleid.apple.com/auth/authorize');
  });

  it('displays a generic OAuth error when Google login fails', async () => {
    mockGoogleLogin.mockResolvedValue({ success: false, message: 'Google OAuth belum dikonfigurasi.' });

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Google OAuth belum dikonfigurasi/i),
    );
  });
});
