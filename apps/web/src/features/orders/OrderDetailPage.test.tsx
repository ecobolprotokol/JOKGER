import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfile } from '../auth';
import { OrderDetailPage } from './OrderDetailPage';
import { useCancelOrder, useOrderDetail, useReturnCompletedOrder } from './index';
import type { OrderDetail } from './api';

vi.mock('../auth', () => ({ useProfile: vi.fn() }));
vi.mock('./index', () => ({
  useCancelOrder: vi.fn(),
  useOrderDetail: vi.fn(),
  useReturnCompletedOrder: vi.fn(),
}));

const orderDetail: OrderDetail = {
  id: '00000000-0000-4000-8000-000000000010',
  order_no: 'JKG-20261009-0001',
  shift_id: '00000000-0000-4000-8000-000000000011',
  status: 'completed',
  order_type: 'dine_in',
  bill_state: null,
  table_label: 'A1',
  customer_name: null,
  subtotal: 12000,
  discount_total: 0,
  service_amount: 0,
  tax_amount: 0,
  rounding_amount: 0,
  grand_total: 12000,
  voucher_code: null,
  cancelled_from: null,
  cancel_reason: null,
  created_by: '00000000-0000-4000-8000-000000000012',
  created_at: '2026-10-09T03:00:00.000Z',
  closed_at: '2026-10-09T03:05:00.000Z',
  created_by_name: 'Kasir Satu',
  order_items: [
    {
      id: '00000000-0000-4000-8000-000000000013',
      item_name: 'Es Teh',
      unit_price: 12000,
      modifiers: [{ group: 'Ukuran', name: 'Besar', extra_price: 0 }],
      qty: 1,
      line_total: 12000,
      note: null,
      created_at: '2026-10-09T03:00:00.000Z',
      is_voided: false,
      void_reason: null,
    },
  ],
  payments: [],
  status_history: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderDetail.id}`]}>
      <Routes>
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(useProfile).mockReturnValue({ data: { role: 'admin' } } as never);
    vi.mocked(useCancelOrder).mockReturnValue({ mutateAsync: vi.fn() } as never);
    vi.mocked(useReturnCompletedOrder).mockReturnValue({ mutateAsync: vi.fn() } as never);
  });

  it('menampilkan status memuat tanpa detail kosong', () => {
    vi.mocked(useOrderDetail).mockReturnValue({ isPending: true } as never);
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Memuat aplikasi');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('menampilkan riwayat RPC untuk admin', () => {
    vi.mocked(useOrderDetail).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        ...orderDetail,
        status_history: [
          {
            id: '00000000-0000-4000-8000-000000000014',
            action: 'order.status_change',
            payload: { from: 'new', to: 'processing' },
            created_at: orderDetail.created_at,
            actor_name: 'Kasir Satu',
          },
        ],
      },
    } as never);
    renderPage();

    expect(screen.getByRole('heading', { name: orderDetail.order_no })).toBeVisible();
    expect(screen.getAllByText('Kasir Satu')).toHaveLength(2);
    expect(screen.getByText('Es Teh')).toBeVisible();
    expect(screen.getByText('Ukuran: Besar')).toBeVisible();
    expect(useOrderDetail).toHaveBeenCalledWith(orderDetail.id, true);
    expect(screen.getByText('Status berubah: Baru → Diproses')).toBeVisible();
  });

  it('memuat riwayat status hanya untuk super admin', () => {
    vi.mocked(useProfile).mockReturnValue({ data: { role: 'super_admin' } } as never);
    vi.mocked(useOrderDetail).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        ...orderDetail,
        status_history: [
          {
            id: '00000000-0000-4000-8000-000000000015',
            action: 'order.status_change',
            payload: { from: 'new', to: 'processing' },
            created_at: orderDetail.created_at,
            actor_name: 'Kasir Satu',
          },
        ],
      },
    } as never);
    renderPage();

    expect(screen.getByText('Status berubah: Baru → Diproses')).toBeVisible();
    expect(useOrderDetail).toHaveBeenCalledWith(orderDetail.id, true);
  });
});
