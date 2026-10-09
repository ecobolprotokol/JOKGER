import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const paymentAccountSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(['transfer', 'ewallet']),
  provider: z.string(),
  account_name: z.string(),
  account_no: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

export type PaymentAccount = z.infer<typeof paymentAccountSchema>;

export async function readActivePaymentAccounts(): Promise<Result<PaymentAccount[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id, method, provider, account_name, account_no, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(paymentAccountSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar rekening pembayaran tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function readPaymentAccounts(): Promise<Result<PaymentAccount[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('payment_accounts')
    .select('id, method, provider, account_name, account_no, sort_order, is_active')
    .order('sort_order');
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(paymentAccountSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar rekening pembayaran tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

const paymentAccountInputSchema = z.object({
  id: z.string().uuid().optional(),
  method: z.enum(['transfer', 'ewallet']),
  provider: z.string().trim().min(1).max(60),
  account_name: z.string().trim().min(1).max(100),
  account_no: z.string().regex(/^[0-9]{5,30}$/),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});

export type PaymentAccountInput = z.infer<typeof paymentAccountInputSchema>;

export async function upsertPaymentAccount(
  input: PaymentAccountInput,
): Promise<Result<PaymentAccount>> {
  const parsedInput = paymentAccountInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('upsert_payment_account', {
    p_account: {
      ...(parsedInput.data.id ? { id: parsedInput.data.id } : {}),
      method: parsedInput.data.method,
      provider: parsedInput.data.provider,
      account_name: parsedInput.data.account_name,
      account_no: parsedInput.data.account_no,
      sort_order: parsedInput.data.sort_order,
      is_active: parsedInput.data.is_active,
    },
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = paymentAccountSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons rekening pembayaran tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function setPaymentAccountActive(
  accountId: string,
  active: boolean,
): Promise<Result<PaymentAccount>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('set_payment_account_active', {
    p_account_id: accountId,
    p_active: active,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = paymentAccountSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons rekening pembayaran tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
