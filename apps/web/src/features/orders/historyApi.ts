import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const historyOrderSchema = z.object({
  id: z.string().uuid(),
  order_no: z.string(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']),
  order_type: z.enum(['dine_in', 'takeaway']),
  bill_state: z.enum(['open', 'closed']).nullable(),
  table_label: z.string().nullable(),
  customer_name: z.string().nullable(),
  grand_total: z.coerce.number().int(),
  created_at: z.string(),
  created_by: z.string().uuid(),
  order_items: z.array(z.object({ item_name: z.string(), qty: z.number().int() })),
  payments: z.array(z.object({ method: z.enum(['cash', 'transfer', 'ewallet']) })),
});

const historyFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['all', 'new', 'processing', 'ready', 'completed', 'cancelled']),
  method: z.enum(['all', 'cash', 'transfer', 'ewallet']),
  orderType: z.enum(['all', 'dine_in', 'takeaway']),
  cashierId: z.string().optional(),
  search: z.string().trim().max(80),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(25).max(5000),
});

const cashierSchema = z.object({ id: z.string().uuid(), full_name: z.string() });

export type HistoryOrder = z.infer<typeof historyOrderSchema>;
export type HistoryFilters = z.infer<typeof historyFiltersSchema>;
export type HistoryCashier = z.infer<typeof cashierSchema>;
export type HistoryPageData = { rows: HistoryOrder[]; total: number };

function jakartaDateStart(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

function jakartaDateEndExclusive(date: string): string {
  const end = new Date(`${date}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

export async function readHistoryOrders(input: HistoryFilters): Promise<Result<HistoryPageData>> {
  const parsedInput = historyFiltersSchema.safeParse(input);
  if (!parsedInput.success || parsedInput.data.to < parsedInput.data.from) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }

  const filters = parsedInput.data;
  const paymentSelection = filters.method === 'all' ? 'payments(method)' : 'payments!inner(method)';
  let query = supabase
    .from('orders')
    .select(
      `id, order_no, status, order_type, bill_state, table_label, customer_name, grand_total,
       created_at, created_by, order_items(item_name, qty), ${paymentSelection}`,
      { count: 'exact' },
    )
    .gte('created_at', jakartaDateStart(filters.from))
    .lt('created_at', jakartaDateEndExclusive(filters.to))
    .order('created_at', { ascending: false });

  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.orderType !== 'all') query = query.eq('order_type', filters.orderType);
  if (filters.method !== 'all') query = query.eq('payments.method', filters.method);
  if (filters.cashierId) query = query.eq('created_by', filters.cashierId);
  if (filters.search) query = query.ilike('order_no', `%${filters.search}%`);

  const start = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(start, start + filters.pageSize - 1);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsedRows = z.array(historyOrderSchema).safeParse(data);
  if (!parsedRows.success) {
    return { ok: false, error: toAppError(new Error('Riwayat pesanan tidak valid.')) };
  }
  return { ok: true, data: { rows: parsedRows.data, total: count ?? parsedRows.data.length } };
}

export async function readHistoryCashiers(): Promise<Result<HistoryCashier[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name');
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(cashierSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar kasir tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function readHistoryExport(
  filters: Omit<HistoryFilters, 'page' | 'pageSize'>,
): Promise<Result<HistoryOrder[]>> {
  const result = await readHistoryOrders({ ...filters, page: 1, pageSize: 5000 });
  if (!result.ok) {
    return result;
  }
  if (result.data.total > 5000) {
    return {
      ok: false,
      error: {
        code: 'HISTORY_EXPORT_TOO_LARGE',
        message: 'Persempit filter hingga maksimal 5.000 pesanan sebelum mengekspor.',
        retryable: false,
      },
    };
  }
  return { ok: true, data: result.data.rows };
}
