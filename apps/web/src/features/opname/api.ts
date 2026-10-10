import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import {
  opnameDetailSchema,
  opnameSummarySchema,
  saveCountsSchema,
  type OpnameDetail,
  type OpnameSummary,
} from './schemas';

export async function readOpnames(): Promise<Result<OpnameSummary[]>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase
    .from('stock_opnames')
    .select('id, status, opened_at, finalized_at, opened_by, profiles(full_name)')
    .order('opened_at', { ascending: false });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = z.array(opnameSummarySchema).safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Daftar opname tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function readOpname(opnameId: string): Promise<Result<OpnameDetail | null>> {
  if (!z.string().uuid().safeParse(opnameId).success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase
    .from('stock_opnames')
    .select(
      'id, status, opened_at, finalized_at, opened_by, profiles(full_name), stock_opname_lines(inventory_item_id, system_qty, counted_qty, inventory_items(name, unit, unit_cost))',
    )
    .eq('id', opnameId)
    .maybeSingle();
  if (error) return { ok: false, error: toAppError(error) };
  if (!data) return { ok: true, data: null };
  const parsed = opnameDetailSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Detail opname tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function openOpname(): Promise<Result<OpnameSummary>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('open_stock_opname');
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = opnameSummarySchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Respons opname tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function saveOpnameCounts(
  opnameId: string,
  counts: z.input<typeof saveCountsSchema>,
): Promise<Result<OpnameSummary>> {
  const parsedCounts = saveCountsSchema.safeParse(counts);
  if (!parsedCounts.success) return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('save_stock_opname_count', {
    p_opname_id: opnameId,
    p_counts: parsedCounts.data,
  });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = opnameSummarySchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Simpanan opname tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function finalizeOpname(opnameId: string): Promise<Result<OpnameSummary>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('finalize_stock_opname', { p_opname_id: opnameId });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = opnameSummarySchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Finalisasi opname tidak valid.')) };
  return { ok: true, data: parsed.data };
}
