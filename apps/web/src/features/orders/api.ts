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
const detailItemSchema = z.object({
  id: z.string().uuid(),
  item_name: z.string(),
  unit_price: z.coerce.number().int(),
  modifiers: z.array(
    z.object({
      group: z.string(),
      name: z.string(),
      extra_price: z.coerce.number().int(),
    }),
  ),
  qty: z.number().int(),
  line_total: z.coerce.number().int(),
  note: z.string().nullable(),
  created_at: z.string(),
  is_voided: z.boolean(),
  void_reason: z.string().nullable(),
});
const detailPaymentSchema = z.object({
  id: z.string().uuid(),
  method: z.enum(['cash', 'transfer', 'ewallet']),
  amount: z.coerce.number().int(),
  received_amount: z.coerce.number().int().nullable(),
  change_amount: z.coerce.number().int(),
  is_refund: z.boolean(),
  status: z.enum(['pending_verification', 'verified', 'rejected']),
  reference_no: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  payment_accounts: z.object({ provider: z.string(), account_name: z.string() }).nullable(),
});
const detailOrderSchema = z.object({
  id: z.string().uuid(),
  order_no: z.string(),
  shift_id: z.string().uuid(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']),
  order_type: z.enum(['dine_in', 'takeaway']),
  bill_state: z.enum(['open', 'closed']).nullable(),
  table_label: z.string().nullable(),
  customer_name: z.string().nullable(),
  subtotal: z.coerce.number().int(),
  discount_total: z.coerce.number().int(),
  service_amount: z.coerce.number().int(),
  tax_amount: z.coerce.number().int(),
  rounding_amount: z.coerce.number().int(),
  grand_total: z.coerce.number().int(),
  voucher_code: z.string().nullable(),
  cancelled_from: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']).nullable(),
  cancel_reason: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  order_items: z.array(detailItemSchema),
  payments: z.array(detailPaymentSchema),
});
const auditEntrySchema = z.object({
  id: z.coerce.number().int(),
  actor_id: z.string().uuid().nullable(),
  action: z.string(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});
const returnOrderInputSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(200),
});

export type OrderSummary = z.infer<typeof orderSchema>;
export type OrderStatus = OrderSummary['status'];
export type OrderDetail = z.infer<typeof detailOrderSchema> & {
  created_by_name: string;
  status_history: Array<z.infer<typeof auditEntrySchema> & { actor_name: string }>;
};

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

export async function readOrderDetail(
  orderId: string,
  includeStatusHistory: boolean,
): Promise<Result<OrderDetail | null>> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_no, shift_id, status, order_type, bill_state, table_label, customer_name,
       subtotal, discount_total, service_amount, tax_amount, rounding_amount, grand_total,
       voucher_code, cancelled_from, cancel_reason, created_by, created_at, closed_at,
      order_items(id, item_name, unit_price, modifiers, qty, line_total, note, created_at, is_voided, void_reason),
       payments(id, method, amount, received_amount, change_amount, is_refund, status, reference_no,
         note, created_at, payment_accounts(provider, account_name))`,
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  if (!data) {
    return { ok: true, data: null };
  }
  const parsedOrder = detailOrderSchema.safeParse(data);
  if (!parsedOrder.success) {
    return { ok: false, error: toAppError(new Error('Detail pesanan tidak valid.')) };
  }

  const { data: creator, error: creatorError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', parsedOrder.data.created_by)
    .maybeSingle();
  if (creatorError) {
    return { ok: false, error: toAppError(creatorError) };
  }

  let statusHistory: OrderDetail['status_history'] = [];
  if (includeStatusHistory) {
    const { data: auditRows, error: auditError } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, payload, created_at')
      .eq('entity', 'order')
      .eq('entity_id', orderId)
      .order('created_at', { ascending: true });
    if (auditError) {
      return { ok: false, error: toAppError(auditError) };
    }
    const parsedAudit = z.array(auditEntrySchema).safeParse(auditRows);
    if (!parsedAudit.success) {
      return { ok: false, error: toAppError(new Error('Riwayat pesanan tidak valid.')) };
    }
    const actorIds = [
      ...new Set(parsedAudit.data.flatMap((entry) => (entry.actor_id ? [entry.actor_id] : []))),
    ];
    const { data: actors, error: actorsError } = actorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
      : { data: [], error: null };
    if (actorsError) {
      return { ok: false, error: toAppError(actorsError) };
    }
    const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]));
    statusHistory = parsedAudit.data.map((entry) => ({
      ...entry,
      actor_name: entry.actor_id ? (actorNames.get(entry.actor_id) ?? '') : '',
    }));
  }

  return {
    ok: true,
    data: {
      ...parsedOrder.data,
      created_by_name: creator?.full_name ?? '',
      status_history: statusHistory,
    },
  };
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

export async function returnCompletedOrder(
  orderId: string,
  reason: string,
): Promise<Result<OrderSummary>> {
  const parsedInput = returnOrderInputSchema.safeParse({ orderId, reason });
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('return_completed_order', {
    p_order_id: parsedInput.data.orderId,
    p_reason: parsedInput.data.reason,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = orderSchema.safeParse({ ...data, order_items: [] });
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons retur pesanan tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
