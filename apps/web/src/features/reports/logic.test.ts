import { describe, expect, it } from 'vitest';
import { hourlySeries, inclusiveRangeDays, jakartaToday } from './logic';
import type { SalesReport } from './schemas';

const emptyReport: SalesReport = {
  summary: {
    totalSales: 0,
    totalTransactions: 0,
    avgTransaction: 0,
    totalRefund: 0,
    totalDiscount: 0,
    totalService: 0,
    totalTax: 0,
    totalVoid: 0,
  },
  daily: [],
  hourly: [],
  byMethod: [],
  byCategory: [],
  byItem: [],
  byVoucher: [],
};

describe('report logic', () => {
  it('menghitung rentang inklusif dan menolak tanggal terbalik', () => {
    expect(inclusiveRangeDays({ from: '2026-01-01', to: '2026-01-01' })).toBe(1);
    expect(inclusiveRangeDays({ from: '2025-01-01', to: '2026-01-01' })).toBe(366);
    expect(inclusiveRangeDays({ from: '2024-12-31', to: '2026-01-01' })).toBe(367);
    expect(inclusiveRangeDays({ from: '2026-01-02', to: '2026-01-01' })).toBeNull();
  });

  it('menghasilkan 24 jam dan mengisi jam tanpa pembayaran dengan nol', () => {
    const report = {
      ...emptyReport,
      hourly: [{ hour: 23, totalSales: 5000, totalTransactions: 1 }],
    };
    const series = hourlySeries(report);
    expect(series.labels).toHaveLength(24);
    expect(series.labels[0]).toBe('00');
    expect(series.values[0]).toBe(0);
    expect(series.values[23]).toBe(5000);
  });

  it('mengambil tanggal hari ini menurut zona Asia/Jakarta', () => {
    expect(jakartaToday(new Date('2026-10-09T17:30:00.000Z'))).toBe('2026-10-10');
  });
});
