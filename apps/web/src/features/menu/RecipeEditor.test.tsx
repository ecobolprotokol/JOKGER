import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeEditor } from './RecipeEditor';
import { useInventoryItems } from '../inventory';
import { useMenuRecipe, useUpsertRecipe } from './index';

vi.mock('../inventory', () => ({ useInventoryItems: vi.fn() }));
vi.mock('./index', () => ({ useMenuRecipe: vi.fn(), useUpsertRecipe: vi.fn() }));

const item = {
  id: '00000000-0000-4000-8000-000000000002',
  category_id: '00000000-0000-4000-8000-000000000001',
  name: 'Es Teh',
  description: null,
  price: 8000,
  image_url: null,
  is_available: true,
  is_active: true,
  sort_order: 0,
  modifierGroups: [],
};
const stockItem = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Teh',
  unit: 'g',
  current_qty: 100,
  min_qty: 0,
  unit_cost: 100,
  is_active: true,
};
const saveRecipe = vi.fn();

describe('RecipeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInventoryItems).mockReturnValue({
      isPending: false,
      isError: false,
      data: [stockItem],
    } as unknown as ReturnType<typeof useInventoryItems>);
    vi.mocked(useMenuRecipe).mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [],
    } as unknown as ReturnType<typeof useMenuRecipe>);
    vi.mocked(useUpsertRecipe).mockReturnValue({
      mutate: saveRecipe,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpsertRecipe>);
  });

  it('menyimpan beberapa bahan dengan jumlah per porsi', async () => {
    const user = userEvent.setup();
    render(<RecipeEditor item={item} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Tambah bahan' }));
    await user.selectOptions(screen.getByLabelText('Bahan'), stockItem.id);
    await user.click(screen.getByRole('button', { name: 'Simpan resep' }));

    expect(saveRecipe).toHaveBeenCalledWith(
      {
        menuItemId: item.id,
        lines: [{ inventory_item_id: stockItem.id, qty_per_serving: 1 }],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
