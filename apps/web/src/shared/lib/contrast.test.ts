import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  darkenHex,
  getContrastTextColor,
  hexToRgb,
  lightenHex,
  validateBrandContrast,
  validateContrast,
} from './contrast';

describe('contrast helpers', () => {
  it('membaca warna hex tiga dan enam digit serta menolak format invalid', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('123456')).toEqual({ r: 18, g: 52, b: 86 });
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('#GGGGGG')).toBeNull();
  });

  it('menghitung rasio, memilih teks kontras, dan memeriksa ukuran teks', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('invalid', '#FFFFFF')).toBeNull();
    expect(getContrastTextColor('#000000')).toBe('#FFFFFF');
    expect(getContrastTextColor('invalid')).toBe('#1B1410');
    expect(validateContrast('#000000', '#FFFFFF').passes).toBe(true);
    expect(validateContrast('#777777', '#FFFFFF').passes).toBe(false);
    expect(validateContrast('#777777', '#FFFFFF', true).required).toBe(3);
    expect(validateContrast('invalid', '#FFFFFF')).toEqual({
      passes: false,
      ratio: 0,
      required: 0,
    });
  });

  it('memeriksa seluruh kombinasi warna brand', () => {
    expect(
      validateBrandContrast('#000000', '#333333', '#000000', '#FFFFFF', '#FFFFFF', '#666666')
        .allPass,
    ).toBe(true);
    expect(
      validateBrandContrast('#777777', '#777777', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#777777')
        .allPass,
    ).toBe(false);
  });

  it('menggelapkan dan mencerahkan warna serta mempertahankan hex invalid', () => {
    expect(darkenHex('#808080', 50)).toBe('#404040');
    expect(lightenHex('#000000', 50)).toBe('#808080');
    expect(darkenHex('invalid', 20)).toBe('invalid');
    expect(lightenHex('invalid', 20)).toBe('invalid');
  });
});
