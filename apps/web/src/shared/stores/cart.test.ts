import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore } from './cart';

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
    localStorage.clear();
  });

  it('menggabungkan baris item yang sama dan menaikkan jumlahnya', () => {
    const store = useCartStore.getState();
    const line = {
      menuItemId: 'menu-1',
      name: 'Minuman',
      unitPrice: 12000,
      modifierOptionIds: [],
      modifierLabels: [],
      note: null,
    };

    store.addLine(line);
    store.addLine(line);

    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0]?.qty).toBe(2);
  });

  it('mempertahankan clientRef hingga keranjang dikosongkan', () => {
    const first = useCartStore.getState().ensureClientRef();
    expect(useCartStore.getState().ensureClientRef()).toBe(first);
    useCartStore.getState().clear();
    expect(useCartStore.getState().clientRef).toBeNull();
  });
});
