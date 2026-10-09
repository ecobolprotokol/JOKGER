import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const storeSettingsSchema = z.object({
  store_name: z.string(),
  tax_percent: z.coerce.number().min(0).max(100),
  service_percent: z.coerce.number().min(0).max(100),
  rounding_rule: z.enum(['none', 'up_100', 'nearest_100']),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export async function readStoreSettings(): Promise<Result<StoreSettings>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, tax_percent, service_percent, rounding_rule')
    .eq('id', 1)
    .single();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = storeSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Pengaturan toko tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
