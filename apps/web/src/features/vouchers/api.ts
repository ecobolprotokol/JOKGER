import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import { calculateVoucherDiscount } from '../../shared/lib/money';

const voucherSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(['percent', 'nominal']),
  value: z.coerce.number().int().positive(),
  min_subtotal: z.coerce.number().int().nonnegative(),
  max_discount: z.coerce.number().int().positive().nullable(),
  valid_from: z.string(),
  valid_until: z.string(),
  total_quota: z.number().int().positive().nullable(),
  used_count: z.number().int().nonnegative(),
  is_active: z.boolean(),
});

const voucherInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,32}$/),
    name: z.string().trim().min(1).max(100),
    type: z.enum(['percent', 'nominal']),
    value: z.number().int().positive().max(999_999_999),
    minSubtotal: z.number().int().nonnegative().max(999_999_999),
    maxDiscount: z.number().int().positive().max(999_999_999).nullable(),
    validFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }),
    totalQuota: z.number().int().positive().nullable(),
    isActive: z.boolean(),
  })
  .superRefine((voucher, context) => {
    if (voucher.type === 'percent' && voucher.value > 100) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'Persentase maksimal 100.' });
    }
    if (voucher.type === 'nominal' && voucher.maxDiscount !== null) {
      context.addIssue({
        code: 'custom',
        path: ['maxDiscount'],
        message: 'Batas hanya berlaku untuk persentase.',
      });
    }
    if (Date.parse(voucher.validUntil) <= Date.parse(voucher.validFrom)) {
      context.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'Waktu akhir harus setelah waktu mulai.',
      });
    }
  });

export type Voucher = z.infer<typeof voucherSchema>;
export type VoucherInput = z.input<typeof voucherInputSchema>;
export type VoucherPreview = { code: string; discount: number };

const voucherPreviewSchema = z.object({
  code: z.string(),
  type: z.enum(['percent', 'nominal']),
  value: z.coerce.number().int().positive(),
  min_subtotal: z.coerce.number().int().nonnegative(),
  max_discount: z.coerce.number().int().positive().nullable(),
  valid_from: z.string(),
  valid_until: z.string(),
  total_quota: z.number().int().positive().nullable(),
  used_count: z.number().int().nonnegative(),
  is_active: z.boolean(),
});

export async function validateVoucher(
  code: string,
  subtotal: number,
): Promise<Result<VoucherPreview>> {
  const normalizedCode = code.trim().toUpperCase();
  if (
    !/^[A-Z0-9-]{3,32}$/.test(normalizedCode) ||
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0
  ) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'code, type, value, min_subtotal, max_discount, valid_from, valid_until, total_quota, used_count, is_active',
    )
    .eq('code', normalizedCode)
    .maybeSingle();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = voucherPreviewSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError({ code: 'VOUCHER_NOT_FOUND' }) };
  }
  const voucher = parsed.data;
  const now = Date.now();
  if (!voucher.is_active) return { ok: false, error: toAppError({ code: 'VOUCHER_INACTIVE' }) };
  if (now < Date.parse(voucher.valid_from)) {
    return { ok: false, error: toAppError({ code: 'VOUCHER_NOT_STARTED' }) };
  }
  if (now > Date.parse(voucher.valid_until)) {
    return { ok: false, error: toAppError({ code: 'VOUCHER_EXPIRED' }) };
  }
  if (voucher.total_quota !== null && voucher.used_count >= voucher.total_quota) {
    return { ok: false, error: toAppError({ code: 'VOUCHER_QUOTA_EXCEEDED' }) };
  }
  if (subtotal < voucher.min_subtotal) {
    return { ok: false, error: toAppError({ code: 'VOUCHER_MIN_SUBTOTAL' }) };
  }
  return {
    ok: true,
    data: {
      code: voucher.code,
      discount: calculateVoucherDiscount({
        subtotal,
        type: voucher.type,
        value: voucher.value,
        maxDiscount: voucher.max_discount,
      }),
    },
  };
}

export async function readVouchers(): Promise<Result<Voucher[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'id, code, name, type, value, min_subtotal, max_discount, valid_from, valid_until, total_quota, used_count, is_active',
    )
    .order('code');
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(voucherSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar voucher tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function upsertVoucher(input: VoucherInput): Promise<Result<Voucher>> {
  const parsedInput = voucherInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const voucher = parsedInput.data;
  const { data, error } = await supabase.rpc('upsert_voucher', {
    p_voucher: {
      ...(voucher.id ? { id: voucher.id } : {}),
      code: voucher.code,
      name: voucher.name,
      type: voucher.type,
      value: voucher.value,
      min_subtotal: voucher.minSubtotal,
      max_discount: voucher.maxDiscount,
      valid_from: voucher.validFrom,
      valid_until: voucher.validUntil,
      total_quota: voucher.totalQuota,
      is_active: voucher.isActive,
    },
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = voucherSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons voucher tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function setVoucherActive(
  voucherId: string,
  active: boolean,
): Promise<Result<Voucher>> {
  if (!z.string().uuid().safeParse(voucherId).success || typeof active !== 'boolean') {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('set_voucher_active', {
    p_voucher_id: voucherId,
    p_active: active,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = voucherSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons status voucher tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
