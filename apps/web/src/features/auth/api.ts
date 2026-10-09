import type { Session } from '@supabase/supabase-js';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import { profileSchema, type Profile } from './types';

export type { Session } from '@supabase/supabase-js';

export async function signIn(email: string, password: string): Promise<Result<Session>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { ok: false, error: toAppError(error ?? new Error('Sesi tidak tersedia.')) };
  }
  return { ok: true, data: data.session };
}

export async function readProfile(userId: string): Promise<Result<Profile | null>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  if (data === null) {
    return { ok: true, data: null };
  }
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Profil tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function signOut(): Promise<Result<null>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return { ok: true, data: null };
}

export async function resetPassword(email: string): Promise<Result<null>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return { ok: true, data: null };
}
