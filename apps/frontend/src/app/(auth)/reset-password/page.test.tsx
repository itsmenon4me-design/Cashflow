import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { resetPasswordMock, replaceMock } = vi.hoisted(() => ({
  resetPasswordMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({
    get: (key: string) => ({
      token: 'abcd'.repeat(8),
      id: '0b8d58d9-6f1b-4d91-bdc8-3f6dd0e74d08',
    }[key] ?? null),
  }),
}));

vi.mock('@/services/auth.service', () => ({
  authService: {
    resetPassword: resetPasswordMock,
  },
}));

import Page from './page';

describe('Reset password page', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
    replaceMock.mockReset();
  });

  it('shows validation error when password is too short', async () => {
    render(<Page />);

    const [newPasswordInput] = screen.getAllByLabelText(/Kata Sandi Baru/i);
    const confirmInput = screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i);

    fireEvent.change(newPasswordInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: /Reset kata sandi/i }).closest('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimal 12 karakter/i);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('submits valid reset request', async () => {
    resetPasswordMock.mockResolvedValue({ success: true, message: 'ok' });
    render(<Page />);

    const [newPasswordInput] = screen.getAllByLabelText(/Kata Sandi Baru/i);
    const confirmInput = screen.getByLabelText(/Konfirmasi Kata Sandi Baru/i);

    fireEvent.change(newPasswordInput, { target: { value: 'StrongPassword123' } });
    fireEvent.change(confirmInput, { target: { value: 'StrongPassword123' } });
    fireEvent.submit(screen.getByRole('button', { name: /Reset kata sandi/i }).closest('form') as HTMLFormElement);

    await screen.findByRole('status');
    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: 'abcd'.repeat(8),
      id: '0b8d58d9-6f1b-4d91-bdc8-3f6dd0e74d08',
      new_password: 'StrongPassword123',
    });
  });
});
