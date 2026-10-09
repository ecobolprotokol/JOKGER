import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import { shiftSchema, type Shift } from './types';

function parseShift(data: unknown): Result<Shift> {
  const parsed = shiftSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons shift tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function readActiveShift(): Promise<Result<Shift | null>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('shifts')
    .select('id, status, opened_at, opening_cash, expected_cash, actual_cash, difference')
    .eq('status', 'open')
    .maybeSingle();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  if (data === null) {
    return { ok: true, data: null };
  }
  return parseShift(data);
}

export async function openShift(openingCash: number): Promise<Result<Shift>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('open_shift', { p_opening_cash: openingCash });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return parseShift(data);
}

export async function closeShift(actualCash: number, note: string | null): Promise<Result<Shift>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('close_shift', {
    p_actual_cash: actualCash,
    p_note: note,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return parseShift(data);
}
