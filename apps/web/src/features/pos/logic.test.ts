import { describe, expect, it } from 'vitest';
import { calculateLineTotal, calculateTotals } from './logic';
import type { CartLine } from '../../shared/stores/cart';

const line: CartLine = {
  lineId: 'line-1',
  menuItemId: 'menu-1',
  name: 'Menu uji',
  unitPrice: 10_000,
  modifierExtra: 2_500,
  modifierOptionIds: [],
  modifierLabels: [],
  qty: 2,
  note: null,
};

describe('POS totals', () => {
  it('menghitung total baris dari snapshot harga dan modifier', () => {
    expect(calculateLineTotal(line)).toBe(25_000);
  });

  it('menghitung layanan, pajak, dan pembulatan dari keranjang', () => {
    expect(calculateTotals([line], 0, 5, 10, 'up_100').grandTotal).toBe(28_900);
  });
});
