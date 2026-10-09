import { z } from 'zod';

export const createOrderSchema = z.object({
  clientRef: z.string().uuid(),
  orderType: z.enum(['dine_in', 'takeaway']),
  billMode: z.enum(['none', 'open']),
  voucherCode: z.string().max(32).nullable(),
  tableLabel: z.string().max(30).nullable(),
  customerName: z.string().max(60).nullable(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(100),
        modifier_option_ids: z.array(z.string().uuid()),
        note: z.string().max(140).nullable(),
      }),
    )
    .min(1),
  payments: z.array(
    z.object({
      method: z.enum(['cash', 'transfer', 'ewallet']),
      amount: z.number().int().positive(),
      received_amount: z.number().int().nonnegative().nullable(),
      payment_account_id: z.string().uuid().nullable(),
      reference_no: z.string().max(40).nullable(),
      proof_path: z.string().nullable(),
    }),
  ),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
