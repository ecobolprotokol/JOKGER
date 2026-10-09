import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const paymentSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  method: z.enum(['transfer', 'ewallet']),
  amount: z.coerce.number().int(),
  reference_no: z.string().nullable(),
  proof_path: z.string().nullable(),
  created_at: z.string(),
  orders: z.object({ order_no: z.string() }).nullable(),
  payment_accounts: z
    .object({ provider: z.string(), account_name: z.string(), account_no: z.string() })
    .nullable(),
});

export type PendingPayment = z.infer<typeof paymentSchema>;

export async function readPendingPayments(): Promise<Result<PendingPayment[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, order_id, method, amount, reference_no, proof_path, created_at, orders(order_no), payment_accounts(provider, account_name, account_no)',
    )
    .eq('status', 'pending_verification')
    .eq('is_refund', false)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(paymentSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Antrian pembayaran tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function createPaymentProofUrl(path: string): Promise<Result<string>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 600);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return { ok: true, data: data.signedUrl };
}

export async function verifyPayment(
  paymentId: string,
  approve: boolean,
  note: string | null,
): Promise<Result<PendingPayment>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('verify_payment', {
    p_payment_id: paymentId,
    p_approve: approve,
    p_note: note,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = paymentSchema.safeParse({ ...data, orders: null, payment_accounts: null });
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons verifikasi tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
