import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

export const storeSettingsSchema = z.object({
  store_name: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  logo_url: z.string().nullable(),
  primary_color: z.string(),
  accent_color: z.string(),
  font_family: z.enum(['Inter', 'Plus Jakarta Sans', 'Poppins', 'system-ui']),
  tax_percent: z.coerce.number().min(0).max(100),
  service_percent: z.coerce.number().min(0).max(100),
  rounding_rule: z.enum(['none', 'up_100', 'nearest_100']),
  receipt_header: z.string().nullable(),
  receipt_footer: z.string().nullable(),
  paper_width_mm: z.union([z.literal(58), z.literal(80)]),
  require_verified_payment: z.boolean(),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export type StoreSettingsPatch = Partial<StoreSettings>;

const staffSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  full_name: z.string(),
  role: z.enum(['admin', 'super_admin']),
  is_active: z.boolean(),
  created_at: z.string(),
});
export type StaffProfile = z.infer<typeof staffSchema>;

export async function readStoreSettings(): Promise<Result<StoreSettings>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase
    .from('store_settings')
    .select(
      'store_name, address, phone, logo_url, primary_color, accent_color, font_family, tax_percent, service_percent, rounding_rule, receipt_header, receipt_footer, paper_width_mm, require_verified_payment',
    )
    .eq('id', 1)
    .single();
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = storeSettingsSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Pengaturan toko tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function updateStoreSettings(
  settings: StoreSettingsPatch,
): Promise<Result<StoreSettings>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  if (Object.keys(settings).length === 0)
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  const { data, error } = await supabase.rpc('update_store_settings', { p_settings: settings });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = storeSettingsSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Respons pengaturan toko tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function readStaff(): Promise<Result<StaffProfile[]>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .order('full_name');
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = z.array(staffSchema).safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Daftar staff tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function setStaffRole(
  userId: string,
  role: StaffProfile['role'],
): Promise<Result<StaffProfile>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('set_staff_role', { p_user_id: userId, p_role: role });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = staffSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Respons staff tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function setStaffActive(
  userId: string,
  active: boolean,
): Promise<Result<StaffProfile>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('set_staff_active', {
    p_user_id: userId,
    p_active: active,
  });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = staffSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Respons staff tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export const staffCreationSchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'super_admin']),
  password: z.string().min(10).max(128),
});
export type StaffCreationInput = z.infer<typeof staffCreationSchema>;

export async function createStaff(
  input: StaffCreationInput,
): Promise<Result<{ id: string; email: string; full_name: string }>> {
  const parsedInput = staffCreationSchema.safeParse(input);
  if (!parsedInput.success) return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) return { ok: false, error: toAppError({ code: 'NOT_AUTHORIZED' }) };
  let response: Response;
  try {
    response = await fetch('/api/admin/create-staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedInput.data),
    });
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
  if (response.status === 201) {
    const payload: unknown = await response.json();
    const parsed = z
      .object({ id: z.string().uuid(), email: z.string().email(), full_name: z.string() })
      .safeParse(payload);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: toAppError(new Error('Respons staff tidak valid.')) };
  }
  let code = response.status === 401 || response.status === 403 ? 'NOT_AUTHORIZED' : 'UNKNOWN';
  if (response.status === 400) {
    try {
      const payload: unknown = await response.json();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        code = payload.error === 'STAFF_EMAIL_EXISTS' ? payload.error : 'INPUT_INVALID';
      } else code = 'INPUT_INVALID';
    } catch {
      code = 'INPUT_INVALID';
    }
  }
  return { ok: false, error: toAppError({ code, status: response.status }) };
}
