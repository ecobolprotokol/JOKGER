import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv, escapeCsvCell, generateCsvFilename, toCsv } from './csv';

describe('CSV helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('meng-escape tanda kutip, koma, dan baris baru serta menyusun kolom', () => {
    expect(escapeCsvCell('normal')).toBe('normal');
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell('baris\nbaru')).toBe('"baris\nbaru"');
    expect(escapeCsvCell('baris\rbaru')).toBe('"baris\rbaru"');
    expect(
      toCsv(
        [{ name: 'Kopi, susu', qty: 2, note: null }],
        [
          { key: 'name', header: 'Nama, item' },
          { key: 'qty', header: 'Qty' },
          { key: 'note', header: 'Catatan' },
        ],
      ),
    ).toBe('"Nama, item",Qty,Catatan\n"Kopi, susu",2,');
  });

  it('membuat nama file bertimestamp dan mendukung ekstensi khusus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T12:34:56.000Z'));
    expect(generateCsvFilename('sales')).toMatch(/^sales-20261009-\d{6}\.csv$/);
    expect(generateCsvFilename('orders', 'txt')).toMatch(/^orders-20261009-\d{6}\.txt$/);
  });

  it('mengunduh CSV UTF-8 dengan BOM dan melepas URL sementara', () => {
    const objectUrl = 'blob:csv-test';
    const createObjectURL = vi.fn().mockReturnValue(objectUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const link = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(link as unknown as HTMLElement);

    downloadCsv('Nama\nKopi', 'laporan.csv');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(link).toMatchObject({ href: objectUrl, download: 'laporan.csv' });
    expect(link.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });
});
