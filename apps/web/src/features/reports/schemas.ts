import { z } from 'zod';

const numeric = z.coerce.number();
export const reportRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const salesReportSchema = z.object({
  summary: z.object({
    totalSales: numeric,
    totalTransactions: numeric,
    avgTransaction: numeric,
    totalRefund: numeric,
    totalDiscount: numeric,
    totalService: numeric,
    totalTax: numeric,
    totalVoid: numeric,
  }),
  daily: z.array(z.object({ date: z.string(), totalSales: numeric, totalTransactions: numeric })),
  hourly: z.array(z.object({ hour: numeric, totalSales: numeric, totalTransactions: numeric })),
  byMethod: z.array(
    z.object({ method: z.enum(['cash', 'transfer', 'ewallet']), totalSales: numeric }),
  ),
  byCategory: z.array(
    z.object({ categoryName: z.string(), totalQty: numeric, totalSales: numeric }),
  ),
  byItem: z.array(
    z.object({
      itemName: z.string(),
      categoryName: z.string(),
      totalQty: numeric,
      totalSales: numeric,
    }),
  ),
  byVoucher: z.array(
    z.object({ code: z.string(), name: z.string(), usageCount: numeric, totalDiscount: numeric }),
  ),
});

export type SalesReport = z.infer<typeof salesReportSchema>;
export type ReportRange = z.infer<typeof reportRangeSchema>;
