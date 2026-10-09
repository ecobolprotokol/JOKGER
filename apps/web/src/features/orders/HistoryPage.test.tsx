import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './HistoryPage';
import { useExportHistory, useHistoryCashiers, useHistoryOrders } from './historyHooks';
import type { HistoryOrder } from './historyApi';

vi.mock('./historyHooks', () => ({
  useExportHistory: vi.fn(),
  useHistoryCashiers: vi.fn(),
  useHistoryOrders: vi.fn(),
}));

const row: HistoryOrder = {
  id: '00000000-0000-4000-8000-000000000031',
  order_no: 'JKG-20261009-0001',
  status: 'completed',
  order_type: 'dine_in',
  bill_state: null,
  table_label: 'A1',
  customer_name: null,
  grand_total: 12000,
  created_at: '2026-10-09T03:00:00.000Z',
  created_by: '00000000-0000-4000-8000-000000000032',
  order_items: [{ item_name: 'Es Teh', qty: 1 }],
  payments: [{ method: 'cash' }],
};

function renderPage(entry = '/history') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HistoryPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(useHistoryOrders).mockReturnValue({
      isPending: false,
      isError: false,
      data: { rows: [row], total: 1 },
    } as never);
    vi.mocked(useHistoryCashiers).mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: row.created_by, full_name: 'Kasir Satu' }],
    } as never);
    vi.mocked(useExportHistory).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it('menampilkan loading state', () => {
    vi.mocked(useHistoryOrders).mockReturnValue({ isPending: true } as never);
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat aplikasi');
  });

  it('menampilkan hasil dan tautan detail pesanan', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Riwayat transaksi' })).toBeVisible();
    expect(screen.getByRole('link', { name: row.order_no })).toHaveAttribute(
      'href',
      `/orders/${row.id}`,
    );
    expect(screen.getByText('1x Es Teh')).toBeVisible();
    const orderRow = screen.getByRole('row', { name: /JKG-20261009-0001/ });
    expect(within(orderRow).getByText('Kasir Satu')).toBeVisible();
  });

  it('menerapkan filter status dan reset halaman melalui query string', async () => {
    const user = userEvent.setup();
    renderPage('/history?page=3');

    await user.selectOptions(screen.getByLabelText('Status'), 'completed');

    await waitFor(() => {
      expect(useHistoryOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'completed', page: 1 }),
      );
    });
  });

  it('mengubah nomor halaman tanpa mereset filter aktif', async () => {
    const user = userEvent.setup();
    vi.mocked(useHistoryOrders).mockReturnValue({
      isPending: false,
      isError: false,
      data: { rows: [row], total: 51 },
    } as never);
    renderPage('/history?status=completed&page=1');

    await user.click(screen.getByRole('button', { name: 'Halaman selanjutnya' }));

    await waitFor(() => {
      expect(useHistoryOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'completed', page: 2, pageSize: 25 }),
      );
    });
  });
});
