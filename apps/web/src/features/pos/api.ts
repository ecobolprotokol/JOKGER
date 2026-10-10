import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';
import { createOrderSchema, type CreateOrderInput } from './schemas';

const createdOrderSchema = z.object({
  id: z.string().uuid(),
  order_no: z.string(),
  grand_total: z.number().int(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']),
});
const submittedPaymentSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.enum(['pending_verification', 'verified', 'rejected']),
  amount: z.number().int(),
});

export type CreatedOrder = z.infer<typeof createdOrderSchema>;
export type OpenBillPayment = CreateOrderInput['payments'][number];

const addOpenBillItemsSchema = z.object({
  clientRef: z.string().uuid(),
  orderId: z.string().uuid(),
  items: createOrderSchema.shape.items,
});
const closeOpenBillSchema = z.object({
  clientRef: z.string().uuid(),
  orderId: z.string().uuid(),
  payments: z.array(createOrderSchema.shape.payments.element).min(1),
  voucherCode: z.string().max(32).nullable(),
});
const openBillResultSchema = z.object({
  id: z.string().uuid(),
  order_no: z.string(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']),
  bill_state: z.enum(['open', 'closed']).nullable(),
});

export async function createOrder(input: CreateOrderInput): Promise<Result<CreatedOrder>> {
  const parsedInput = createOrderSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_client_ref: parsedInput.data.clientRef,
    p_order_type: parsedInput.data.orderType,
    p_items: parsedInput.data.items,
    p_voucher_code: parsedInput.data.voucherCode,
    p_table_label: parsedInput.data.tableLabel,
    p_customer_name: parsedInput.data.customerName,
    p_bill_mode: parsedInput.data.billMode,
    p_payments: parsedInput.data.payments,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsedOrder = createdOrderSchema.safeParse(data);
  if (!parsedOrder.success) {
    return { ok: false, error: toAppError(new Error('Respons pesanan tidak valid.')) };
  }
  return { ok: true, data: parsedOrder.data };
}

export async function uploadPaymentProof(file: File, orderId: string): Promise<Result<string>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const path = `${dateParts.year}/${dateParts.month}/${dateParts.day}/${orderId}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, {
    cacheControl: '600',
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: toAppError(error) };
  return { ok: true, data: path };
}

export async function submitPayment(input: {
  clientRef: string;
  orderId: string;
  method: 'cash' | 'transfer' | 'ewallet';
  amount: number;
  paymentAccountId: string | null;
  referenceNo: string | null;
  proofPath: string | null;
  receivedAmount: number | null;
}): Promise<Result<z.infer<typeof submittedPaymentSchema>>> {
  if (!supabase) return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  const { data, error } = await supabase.rpc('submit_payment', {
    p_client_ref: input.clientRef,
    p_order_id: input.orderId,
    p_method: input.method,
    p_amount: input.amount,
    p_payment_account_id: input.paymentAccountId,
    p_reference_no: input.referenceNo,
    p_proof_path: input.proofPath,
    p_received_amount: input.receivedAmount,
  });
  if (error) return { ok: false, error: toAppError(error) };
  const parsed = submittedPaymentSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: toAppError(new Error('Respons pembayaran tidak valid.')) };
  return { ok: true, data: parsed.data };
}

export async function addItemsToOpenBill(
  clientRef: string,
  orderId: string,
  items: CreateOrderInput['items'],
): Promise<Result<z.infer<typeof openBillResultSchema>>> {
  const parsedInput = addOpenBillItemsSchema.safeParse({ clientRef, orderId, items });
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('add_items_to_open_bill', {
    p_client_ref: parsedInput.data.clientRef,
    p_order_id: parsedInput.data.orderId,
    p_items: parsedInput.data.items,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = openBillResultSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons open bill tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function voidOpenBillItem(
  itemId: string,
  reason: string,
): Promise<Result<z.infer<typeof openBillResultSchema>>> {
  const parsedInput = z
    .object({
      itemId: z.string().uuid(),
      reason: z.string().trim().min(3).max(200),
    })
    .safeParse({ itemId, reason });
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('void_order_item', {
    p_item_id: parsedInput.data.itemId,
    p_reason: parsedInput.data.reason,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = openBillResultSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons void bill tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function closeOpenBill(input: {
  clientRef: string;
  orderId: string;
  payments: OpenBillPayment[];
  voucherCode: string | null;
}): Promise<Result<CreatedOrder>> {
  const parsedInput = closeOpenBillSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('close_open_bill', {
    p_client_ref: parsedInput.data.clientRef,
    p_order_id: parsedInput.data.orderId,
    p_payments: parsedInput.data.payments,
    p_voucher_code: parsedInput.data.voucherCode,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = createdOrderSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons penutupan bill tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
