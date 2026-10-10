import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import {
  reportRangeSchema,
  salesReportSchema,
  type ReportRange,
  type SalesReport,
} from './schemas';

export async function readSalesReport(range: ReportRange): Promise<Result<SalesReport>> {
  const parsedRange = reportRangeSchema.safeParse(range);
  if (!parsedRange.success) return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('get_sales_report', {
    p_from: parsedRange.data.from,
    p_to: parsedRange.data.to,
  });
  if (error) return { ok: false, error: toAppError(error) };
  const parsedReport = salesReportSchema.safeParse(data);
  if (!parsedReport.success)
    return { ok: false, error: toAppError(new Error('Data laporan tidak valid.')) };
  return { ok: true, data: parsedReport.data };
}
