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

export type CreatedOrder = z.infer<typeof createdOrderSchema>;

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
