import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActivePaymentAccounts } from '../payment-accounts';
import { useActiveShift } from '../shift';
import { useOrderDetail } from '../orders';
import { OpenBillPage } from './OpenBillPage';
import { useAddItemsToOpenBill, useCloseOpenBill, useVoidOpenBillItem } from './hooks';
import { useMenuCatalog } from '../menu';

vi.mock('../payment-accounts', () => ({ useActivePaymentAccounts: vi.fn() }));
vi.mock('../shift', () => ({ useActiveShift: vi.fn() }));
vi.mock('../orders', () => ({ useOrderDetail: vi.fn() }));
vi.mock('./hooks', () => ({
  useAddItemsToOpenBill: vi.fn(),
  useCloseOpenBill: vi.fn(),
  useVoidOpenBillItem: vi.fn(),
}));
vi.mock('../menu', () => ({ useMenuCatalog: vi.fn() }));
vi.mock('../../shared/stores/connection', () => ({
  useConnectionStore: (selector: (state: { online: boolean }) => boolean) =>
    selector({ online: true }),
}));

const orderId = '00000000-0000-4000-8000-000000000051';
const shiftId = '00000000-0000-4000-8000-000000000052';
const menuItem = {
  id: '00000000-0000-4000-8000-000000000053',
  category_id: '00000000-0000-4000-8000-000000000054',
  name: 'Es Teh',
  description: null,
  price: 8000,
  image_url: null,
  is_available: true,
  is_active: true,
  sort_order: 0,
  modifierGroups: [],
};

const openOrder = {
  id: orderId,
  order_no: 'JKG-20261009-0002',
  shift_id: shiftId,
  status: 'new' as const,
  order_type: 'dine_in' as const,
  bill_state: 'open' as const,
  table_label: 'B2',
  customer_name: null,
  subtotal: 8000,
  discount_total: 0,
  service_amount: 0,
  tax_amount: 0,
  rounding_amount: 0,
  grand_total: 8000,
  voucher_code: null,
  cancelled_from: null,
  cancel_reason: null,
  created_by: '00000000-0000-4000-8000-000000000055',
  created_by_name: 'Kasir Uji',
  created_at: '2026-10-09T03:00:00.000Z',
  closed_at: null,
  order_items: [
    {
      id: '00000000-0000-4000-8000-000000000056',
      item_name: 'Kopi',
      unit_price: 8000,
      modifiers: [],
      qty: 1,
      line_total: 8000,
      note: null,
      created_at: '2026-10-09T03:00:00.000Z',
      is_voided: false,
      void_reason: null,
    },
  ],
  payments: [],
  status_history: [],
};

const addItems = vi.fn();

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/pos/open-bill/${orderId}`]}>
      <Routes>
        <Route path="/pos/open-bill/:orderId" element={<OpenBillPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OpenBillPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(useOrderDetail).mockReturnValue({
      isPending: false,
      isError: false,
      data: openOrder,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useMenuCatalog).mockReturnValue({
      isPending: false,
      isError: false,
      data: { categories: [], items: [menuItem] },
      refetch: vi.fn(),
    } as never);
    vi.mocked(useActiveShift).mockReturnValue({
      isPending: false,
      isError: false,
      data: { id: shiftId },
    } as never);
    vi.mocked(useActivePaymentAccounts).mockReturnValue({
      isPending: false,
      isError: false,
      data: [],
    } as never);
    vi.mocked(useAddItemsToOpenBill).mockReturnValue({
      mutate: addItems,
      isPending: false,
      isError: false,
    } as never);
    vi.mocked(useCloseOpenBill).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(useVoidOpenBillItem).mockReturnValue({ mutateAsync: vi.fn() } as never);
  });

  it('menampilkan bill aktif dan mempertahankan clientRef untuk retry tambah item', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: openOrder.order_no })).toBeVisible();
    expect(screen.getByText('Ditambahkan 10.00')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Es Teh/ }));
    await user.click(screen.getByRole('button', { name: 'Tambah ke bill' }));

    const firstInput = addItems.mock.calls[0]?.[0];
    expect(firstInput).toMatchObject({ items: [{ menu_item_id: menuItem.id, qty: 1 }] });
    expect(firstInput.clientRef).toMatch(/^[0-9a-f-]{36}$/i);
    addItems.mock.calls[0]?.[1].onError(new Error('timeout'));
    await user.click(screen.getByRole('button', { name: 'Tambah ke bill' }));

    expect(addItems.mock.calls[1]?.[0].clientRef).toBe(firstInput.clientRef);
  });

  it('menampilkan bill tertutup sebagai baca saja dan pesanan biasa sebagai bukan bill', () => {
    vi.mocked(useOrderDetail).mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...openOrder, bill_state: 'closed' },
      refetch: vi.fn(),
    } as never);
    renderPage();
    expect(
      screen.getByText('Bill ini hanya dapat dilihat dan tidak menerima perubahan lagi.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tutup bill' })).not.toBeInTheDocument();

    cleanup();
    vi.mocked(useOrderDetail).mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...openOrder, bill_state: null },
      refetch: vi.fn(),
    } as never);
    renderPage();
    expect(screen.getByText('Pesanan ini bukan open bill.')).toBeVisible();
  });
});
