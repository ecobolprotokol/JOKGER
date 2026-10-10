import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const auditRowSchema = z.object({
  id: z.coerce.number().int(),
  actor_id: z.string().uuid().nullable(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  profiles: z.object({ full_name: z.string() }).nullable(),
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export async function readAuditRows(): Promise<Result<AuditRow[]>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, payload, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = z.array(auditRowSchema).safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Daftar audit tidak valid.')) };
  return { ok: true, data: parsed.data };
}
