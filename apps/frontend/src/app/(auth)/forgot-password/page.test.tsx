import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { forgotPasswordMock } = vi.hoisted(() => ({
  forgotPasswordMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/services/auth.service', () => ({
  authService: {
    forgotPassword: forgotPasswordMock,
  },
}));

import Page from './page';

describe('Forgot password page', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it('shows validation error for invalid email', async () => {
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'bad-email' } });
    fireEvent.submit(screen.getByRole('button', { name: /Kirim tautan reset/i }).closest('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Email tidak valid/i);
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  it('submits a valid email and shows success message', async () => {
    forgotPasswordMock.mockResolvedValue({ success: true, message: 'ok' });
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /Kirim tautan reset/i }).closest('form') as HTMLFormElement);

    await screen.findByRole('status');
    expect(forgotPasswordMock).toHaveBeenCalledWith('user@example.com');
  });
});
