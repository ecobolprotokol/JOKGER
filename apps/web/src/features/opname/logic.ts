import type { OpnameLine } from './schemas';

export function lineDifference(line: OpnameLine, countedQty: number | null): number | null {
  return countedQty === null ? null : countedQty - line.system_qty;
}

export function summarizeDifferences(
  lines: OpnameLine[],
  counts: Record<string, number | null>,
): { changedItems: number; totalValue: number; uncounted: number } {
  return lines.reduce(
    (summary, line) => {
      const counted = Object.hasOwn(counts, line.inventory_item_id)
        ? (counts[line.inventory_item_id] ?? null)
        : line.counted_qty;
      if (counted === null) {
        summary.uncounted += 1;
        return summary;
      }
      const difference = counted - line.system_qty;
      if (difference !== 0) {
        summary.changedItems += 1;
        summary.totalValue += Math.round(difference * line.inventory_items.unit_cost);
      }
      return summary;
    },
    { changedItems: 0, totalValue: 0, uncounted: 0 },
  );
}
