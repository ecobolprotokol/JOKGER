import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuPage } from './MenuPage';
import {
  useMenuManagementCatalog,
  useSetMenuItemAvailable,
  useUpsertCategory,
  useUpsertMenuItem,
} from './index';

vi.mock('./index', () => ({
  useMenuManagementCatalog: vi.fn(),
  useSetMenuItemAvailable: vi.fn(),
  useUpsertCategory: vi.fn(),
  useUpsertMenuItem: vi.fn(),
  useUpsertRecipe: vi.fn(),
}));

const category = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Minuman',
  sort_order: 0,
  is_active: true,
};

const menuItem = {
  id: '00000000-0000-4000-8000-000000000002',
  category_id: category.id,
  name: 'Es Teh',
  description: null,
  price: 8000,
  image_url: null,
  is_available: true,
  is_active: true,
  sort_order: 0,
  modifierGroups: [],
};

const setAvailable = vi.fn();
const saveCategory = vi.fn();
const saveMenuItem = vi.fn();

function configureCatalog(categories = [category], items = [menuItem]) {
  vi.mocked(useMenuManagementCatalog).mockReturnValue({
    isPending: false,
    isError: false,
    data: { categories, items },
  } as unknown as ReturnType<typeof useMenuManagementCatalog>);
}

describe('MenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMenuManagementCatalog).mockReturnValue({
      isPending: true,
      isError: false,
    } as ReturnType<typeof useMenuManagementCatalog>);
    vi.mocked(useSetMenuItemAvailable).mockReturnValue({
      mutate: setAvailable,
      isPending: false,
    } as unknown as ReturnType<typeof useSetMenuItemAvailable>);
    vi.mocked(useUpsertCategory).mockReturnValue({
      mutate: saveCategory,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpsertCategory>);
    vi.mocked(useUpsertMenuItem).mockReturnValue({
      mutate: saveMenuItem,
      reset: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpsertMenuItem>);
  });

  it('menampilkan state memuat tanpa menampilkan tabel kosong', () => {
    render(<MenuPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Memuat aplikasi');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('menyediakan alur buat kategori ketika katalog kosong', async () => {
    const user = userEvent.setup();
    configureCatalog([], []);
    render(<MenuPage />);

    expect(screen.getByText('Belum ada kategori. Buat kategori untuk memulai.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tambah kategori' }));
    await user.type(screen.getByLabelText('Nama kategori'), 'Makanan');
    await user.click(screen.getByRole('button', { name: 'Simpan kategori' }));

    expect(saveCategory).toHaveBeenCalledWith(
      { name: 'Makanan', sort_order: 0 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('menampilkan katalog dan meneruskan toggle ketersediaan ke RPC mutation', async () => {
    const user = userEvent.setup();
    configureCatalog();
    render(<MenuPage />);

    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByText('Es Teh')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tersedia' }));

    expect(setAvailable).toHaveBeenCalledWith(
      { itemId: menuItem.id, available: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });
});
