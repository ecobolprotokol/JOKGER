export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return null;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function luminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastTextColor(backgroundHex: string): string {
  const whiteContrast = contrastRatio(backgroundHex, '#FFFFFF');
  const blackContrast = contrastRatio(backgroundHex, '#1B1410');
  if (whiteContrast === null || blackContrast === null) return '#1B1410';
  return whiteContrast >= blackContrast ? '#FFFFFF' : '#1B1410';
}

export function validateContrast(
  foregroundHex: string,
  backgroundHex: string,
  isLargeText = false,
): { passes: boolean; ratio: number; required: number } {
  const ratio = contrastRatio(foregroundHex, backgroundHex);
  if (ratio === null) return { passes: false, ratio: 0, required: 0 };
  const required = isLargeText ? 3 : 4.5;
  return { passes: ratio >= required, ratio, required };
}

export function validateBrandContrast(
  brandHex: string,
  accentHex: string,
  bgHex: string,
  surfaceHex: string,
  textHex: string,
  textMutedHex: string,
): {
  brandContrast: { passes: boolean; ratio: number };
  accentContrast: { passes: boolean; ratio: number };
  bgTextContrast: { passes: boolean; ratio: number };
  surfaceTextMutedContrast: { passes: boolean; ratio: number };
  allPass: boolean;
} {
  const brandContrast = validateContrast(getContrastTextColor(brandHex), brandHex);
  const accentContrast = validateContrast(textHex, accentHex);
  const bgTextContrast = validateContrast(textHex, bgHex);
  const surfaceTextMutedContrast = validateContrast(textMutedHex, surfaceHex);

  return {
    brandContrast,
    accentContrast,
    bgTextContrast,
    surfaceTextMutedContrast,
    allPass:
      brandContrast.passes &&
      accentContrast.passes &&
      bgTextContrast.passes &&
      surfaceTextMutedContrast.passes,
  };
}

export function darkenHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function lightenHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = percent / 100;
  const r = Math.round(rgb.r + (255 - rgb.r) * factor);
  const g = Math.round(rgb.g + (255 - rgb.g) * factor);
  const b = Math.round(rgb.b + (255 - rgb.b) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
