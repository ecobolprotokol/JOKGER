import {
  calculateTotals as calculateMoneyTotals,
  type RoundingRule,
  type Totals,
} from '../../shared/lib/money';
import type { CartLine } from '../../shared/stores/cart';

export function calculateTotals(
  lines: CartLine[],
  discount: number,
  servicePercent: number,
  taxPercent: number,
  roundingRule: RoundingRule,
): Totals {
  return calculateMoneyTotals({
    lines: lines.map((line) => ({
      unitPrice: line.unitPrice,
      modifierExtra: line.modifierExtra,
      quantity: line.qty,
    })),
    discount,
    servicePercent,
    taxPercent,
    roundingRule,
  });
}

export function calculateLineTotal(line: CartLine): number {
  return calculateMoneyTotals({
    lines: [{ unitPrice: line.unitPrice, modifierExtra: line.modifierExtra, quantity: line.qty }],
    discount: 0,
    servicePercent: 0,
    taxPercent: 0,
    roundingRule: 'none',
  }).grandTotal;
}
