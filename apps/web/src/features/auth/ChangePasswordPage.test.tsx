import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordPage } from './ChangePasswordPage';
import { changePassword } from './api';

vi.mock('./api', () => ({
  changePassword: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: 0 }, queries: { retry: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ChangePasswordPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(changePassword).mockResolvedValue({ ok: true, data: null });
  });

  it('menolak konfirmasi yang tidak sama sebelum memanggil API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Kata sandi saat ini'), 'OldPass#2026');
    await user.type(screen.getByLabelText('Kata sandi baru'), 'NewPass#2026');
    await user.type(screen.getByLabelText('Ulangi kata sandi baru'), 'OtherPass#2026');
    await user.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }));

    expect(await screen.findByText('Kata sandi baru belum sama.')).toBeVisible();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('mengirim password baru setelah validasi form lulus', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Kata sandi saat ini'), 'OldPass#2026');
    await user.type(screen.getByLabelText('Kata sandi baru'), 'NewPass#2026');
    await user.type(screen.getByLabelText('Ulangi kata sandi baru'), 'NewPass#2026');
    await user.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith('OldPass#2026', 'NewPass#2026'),
    );
    expect(await screen.findByText('Kata sandi berhasil diganti.')).toBeVisible();
  });
});
