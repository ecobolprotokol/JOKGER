export type RoundingRule = 'none' | 'up_100' | 'nearest_100';

export type PricedLine = {
  unitPrice: number;
  modifierExtra: number;
  quantity: number;
};

export type TotalInput = {
  lines: PricedLine[];
  discount: number;
  servicePercent: number;
  taxPercent: number;
  roundingRule: RoundingRule;
};

export type Totals = {
  subtotal: number;
  discount: number;
  serviceAmount: number;
  taxAmount: number;
  roundingAmount: number;
  grandTotal: number;
};

export type VoucherDiscountInput = {
  subtotal: number;
  type: 'percent' | 'nominal';
  value: number;
  maxDiscount?: number | null;
};

function assertWholeRupiah(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} harus berupa bilangan bulat rupiah nonnegatif.`);
  }
}

export function sumRupiah(values: number[]): number {
  const total = values.reduce((sum, value) => {
    assertWholeRupiah(value, 'Nominal');
    return sum + value;
  }, 0);
  assertWholeRupiah(total, 'Jumlah');
  return total;
}

export function calculateChange(received: number, total: number): number {
  assertWholeRupiah(received, 'Uang diterima');
  assertWholeRupiah(total, 'Total');
  return received - total;
}

export function quickCashAmounts(total: number): number[] {
  assertWholeRupiah(total, 'Total');
  const next = (step: number) => Math.ceil(total / step) * step;
  return [...new Set([total, next(10_000), next(50_000), next(100_000)])];
}

export function calculateStockValue(quantity: number, unitCost: number): number {
  if (!Number.isFinite(quantity) || !Number.isSafeInteger(unitCost) || unitCost < 0) {
    throw new RangeError('Jumlah stok dan harga pokok tidak valid.');
  }
  const value = quantity * unitCost;
  return value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
}

function percentageBasisPoints(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`${field} harus berada di antara 0 dan 100.`);
  }

  const text = String(value);
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new RangeError(`${field} maksimal memiliki dua angka desimal.`);
  }

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

function roundHalfUp(amount: number, basisPoints: number): number {
  return Math.floor((amount * basisPoints + 5_000) / 10_000);
}

export function calculateVoucherDiscount(input: VoucherDiscountInput): number {
  assertWholeRupiah(input.subtotal, 'Subtotal');
  assertWholeRupiah(input.value, 'Nilai voucher');

  if (input.type === 'nominal') {
    return Math.min(input.value, input.subtotal);
  }

  const rate = percentageBasisPoints(input.value, 'Persentase voucher');
  const discount = roundHalfUp(input.subtotal, rate);
  if (input.maxDiscount == null) {
    return Math.min(discount, input.subtotal);
  }

  assertWholeRupiah(input.maxDiscount, 'Batas diskon');
  return Math.min(discount, input.maxDiscount, input.subtotal);
}

export function calculateTotals(input: TotalInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => {
    assertWholeRupiah(line.unitPrice, 'Harga satuan');
    assertWholeRupiah(line.modifierExtra, 'Harga tambahan');
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) {
      throw new RangeError('Jumlah item harus berupa bilangan bulat dari 1 sampai 100.');
    }
    return sum + (line.unitPrice + line.modifierExtra) * line.quantity;
  }, 0);
  assertWholeRupiah(subtotal, 'Subtotal');
  assertWholeRupiah(input.discount, 'Diskon');

  const discount = Math.min(input.discount, subtotal);
  const base = subtotal - discount;
  const serviceAmount = roundHalfUp(base, percentageBasisPoints(input.servicePercent, 'Layanan'));
  const taxAmount = roundHalfUp(
    base + serviceAmount,
    percentageBasisPoints(input.taxPercent, 'Pajak'),
  );
  const beforeRounding = base + serviceAmount + taxAmount;

  const grandTotal =
    input.roundingRule === 'up_100'
      ? Math.ceil(beforeRounding / 100) * 100
      : input.roundingRule === 'nearest_100'
        ? Math.floor((beforeRounding + 50) / 100) * 100
        : beforeRounding;

  return {
    subtotal,
    discount,
    serviceAmount,
    taxAmount,
    roundingAmount: grandTotal - beforeRounding,
    grandTotal,
  };
}
