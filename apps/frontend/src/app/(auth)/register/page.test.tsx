import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    register: vi.fn(),
    sendVerification: vi.fn(),
  },
}));

import Page from './page';

describe('Register page', () => {
  beforeEach(() => {
    mockGoogleLogin.mockReset();
    mockAppleLogin.mockReset();
    useLanguageStore.getState().setLanguage('en');
  });

  it('renders form fields', () => {
    render(<Page />);
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    const passwordLabels = screen.getAllByLabelText(/Password/i);
    expect(passwordLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    render(<Page />);
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'user1' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'u@e.com' } });
    const pwdInputs = screen.getAllByLabelText(/Password/i);
    fireEvent.change(pwdInputs[0], { target: { value: 'passwordpassword' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'mismatch' } });

    fireEvent.click(screen.getByRole('button', { name: /Register/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Passwords do not match/i);
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

  it('shows a loading state while Google login is processing', async () => {
    let resolveGoogle: ((value: { success: boolean; url?: string }) => void) | undefined;
    mockGoogleLogin.mockImplementation(
      () => new Promise((resolve) => { resolveGoogle = resolve; }),
    );

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));

    const googleButton = document.querySelector('[data-slot="button"][data-loading="true"]');
    expect(googleButton).toBeInTheDocument();
    expect(googleButton).toHaveAttribute('aria-busy', 'true');

    resolveGoogle?.({ success: true, url: 'https://accounts.google.com/oauth2/auth' });
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

  it('shows a Google OAuth error when the backend rejects the request', async () => {
    mockGoogleLogin.mockResolvedValue({ success: false, message: 'Google sign-in failed.' });

    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Google sign-in failed/i));
  });
});
