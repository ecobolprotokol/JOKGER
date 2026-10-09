import { describe, expect, it } from 'vitest';
import { calculateStockValue, calculateTotals, calculateVoucherDiscount } from './money';

describe('calculateVoucherDiscount', () => {
  it('menghitung diskon persentase dengan pembulatan half-up dan batas maksimum', () => {
    expect(
      calculateVoucherDiscount({
        subtotal: 15_001,
        type: 'percent',
        value: 10,
        maxDiscount: 1_000,
      }),
    ).toBe(1_000);
    expect(calculateVoucherDiscount({ subtotal: 15_005, type: 'percent', value: 10 })).toBe(1_501);
  });

  it('membatasi diskon nominal pada subtotal', () => {
    expect(calculateVoucherDiscount({ subtotal: 8_000, type: 'nominal', value: 12_000 })).toBe(
      8_000,
    );
  });

  it('menolak nilai rupiah pecahan', () => {
    expect(() => calculateVoucherDiscount({ subtotal: 100.5, type: 'nominal', value: 10 })).toThrow(
      RangeError,
    );
  });
});

describe('calculateTotals', () => {
  const base = {
    lines: [{ unitPrice: 10_000, modifierExtra: 2_500, quantity: 2 }],
    discount: 1_000,
    servicePercent: 5,
    taxPercent: 10,
  };

  it('menghitung subtotal, layanan, pajak, dan total dalam integer rupiah', () => {
    expect(calculateTotals({ ...base, roundingRule: 'none' })).toEqual({
      subtotal: 25_000,
      discount: 1_000,
      serviceAmount: 1_200,
      taxAmount: 2_520,
      roundingAmount: 0,
      grandTotal: 27_720,
    });
  });

  it('menerapkan aturan pembulatan ke seratus rupiah', () => {
    expect(calculateTotals({ ...base, taxPercent: 0, roundingRule: 'up_100' }).grandTotal).toBe(
      25_200,
    );
    expect(
      calculateTotals({
        ...base,
        taxPercent: 0,
        roundingRule: 'nearest_100',
      }).grandTotal,
    ).toBe(25_200);
  });

  it('membulatkan setengah ke atas dan menolak jumlah pecahan', () => {
    expect(
      calculateTotals({
        lines: [{ unitPrice: 1, modifierExtra: 0, quantity: 1 }],
        discount: 0,
        servicePercent: 50,
        taxPercent: 0,
        roundingRule: 'none',
      }).serviceAmount,
    ).toBe(1);
    expect(() =>
      calculateTotals({
        lines: [{ unitPrice: 1, modifierExtra: 0, quantity: 1.5 }],
        discount: 0,
        servicePercent: 0,
        taxPercent: 0,
        roundingRule: 'none',
      }),
    ).toThrow(RangeError);
  });
});

describe('calculateStockValue', () => {
  it('membulatkan nilai stok pecahan ke integer rupiah terdekat', () => {
    expect(calculateStockValue(1.25, 4000)).toBe(5000);
    expect(calculateStockValue(0.333, 1000)).toBe(333);
    expect(calculateStockValue(-0.333, 1000)).toBe(-333);
  });

  it('menolak jumlah non-finite dan biaya unit yang tidak valid', () => {
    expect(() => calculateStockValue(Number.NaN, 1000)).toThrow(RangeError);
    expect(() => calculateStockValue(1, 1000.5)).toThrow(RangeError);
  });
});
