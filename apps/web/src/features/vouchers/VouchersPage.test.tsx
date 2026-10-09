import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VouchersPage } from './VouchersPage';
import { useSetVoucherActive, useUpsertVoucher, useVouchers } from './index';

vi.mock('./index', () => ({
  useSetVoucherActive: vi.fn(),
  useUpsertVoucher: vi.fn(),
  useVouchers: vi.fn(),
}));

const saveVoucher = vi.fn();
const setVoucherActive = vi.fn();

describe('VouchersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetVoucherActive).mockReturnValue({
      mutate: setVoucherActive,
      mutateAsync: setVoucherActive,
      isPending: false,
    } as unknown as ReturnType<typeof useSetVoucherActive>);
    vi.mocked(useUpsertVoucher).mockReturnValue({
      mutate: saveVoucher,
      reset: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpsertVoucher>);
  });

  it('menampilkan status memuat sampai query voucher selesai', () => {
    vi.mocked(useVouchers).mockReturnValue({
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useVouchers>);

    render(<VouchersPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Memuat aplikasi');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('membuka form dari state kosong dan menampilkan pratinjau diskon', async () => {
    const user = userEvent.setup();
    vi.mocked(useVouchers).mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    } as unknown as ReturnType<typeof useVouchers>);

    render(<VouchersPage />);
    expect(screen.getByText('Belum ada voucher.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tambah voucher' }));

    expect(screen.getByRole('heading', { name: 'Tambah voucher' })).toBeVisible();
    expect(screen.getByText('Potongan:')).toHaveTextContent('Rp 10.000');
    expect(screen.getByText('Total setelah potongan:')).toHaveTextContent('Rp 90.000');
  });
});
