import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const orderSchema = z.object({
  id: z.string().uuid(),
  order_no: z.string(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']),
  order_type: z.enum(['dine_in', 'takeaway']),
  bill_state: z.enum(['open', 'closed']).nullable(),
  table_label: z.string().nullable(),
  customer_name: z.string().nullable(),
  grand_total: z.coerce.number().int(),
  created_at: z.string(),
  order_items: z.array(z.object({ qty: z.number().int() })),
});

export type OrderSummary = z.infer<typeof orderSchema>;
export type OrderStatus = OrderSummary['status'];

export async function readRecentOrders(): Promise<Result<OrderSummary[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_no, status, order_type, bill_state, table_label, customer_name, grand_total, created_at, order_items(qty)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(orderSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar pesanan tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Result<OrderSummary>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('change_order_status', {
    p_order_id: orderId,
    p_to_status: status,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = orderSchema.safeParse({ ...data, order_items: [] });
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons pesanan tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function cancelOrder(orderId: string, reason: string): Promise<Result<OrderSummary>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = orderSchema.safeParse({ ...data, order_items: [] });
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons pembatalan tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
