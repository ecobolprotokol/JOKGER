import { describe, expect, it } from 'vitest';
import { lineDifference, summarizeDifferences } from './logic';
import type { OpnameLine } from './schemas';

const lines: OpnameLine[] = [
  {
    inventory_item_id: '00000000-0000-4000-8000-000000000001',
    system_qty: 4,
    counted_qty: null,
    inventory_items: { name: 'Kopi', unit: 'kg', unit_cost: 10000 },
  },
  {
    inventory_item_id: '00000000-0000-4000-8000-000000000002',
    system_qty: 2,
    counted_qty: 3,
    inventory_items: { name: 'Gula', unit: 'kg', unit_cost: 5000 },
  },
  {
    inventory_item_id: '00000000-0000-4000-8000-000000000003',
    system_qty: 1,
    counted_qty: 1,
    inventory_items: { name: 'Susu', unit: 'liter', unit_cost: 8000 },
  },
];

describe('opname calculations', () => {
  it('menghitung selisih termasuk nilai nol dan yang belum dihitung', () => {
    expect(lineDifference(lines[0]!, null)).toBeNull();
    expect(lineDifference(lines[1]!, 3)).toBe(1);
    expect(lineDifference(lines[2]!, 1)).toBe(0);
  });

  it('merangkum selisih nilai stok dan jumlah bahan belum dihitung', () => {
    expect(summarizeDifferences(lines, {})).toEqual({
      changedItems: 1,
      totalValue: 5000,
      uncounted: 1,
    });
  });

  it('memakai nilai lokal, termasuk nilai kosong, alih-alih snapshot server', () => {
    expect(
      summarizeDifferences(lines, {
        [lines[0]!.inventory_item_id]: 3,
        [lines[1]!.inventory_item_id]: null,
      }),
    ).toEqual({ changedItems: 1, totalValue: -10000, uncounted: 1 });
  });
});
