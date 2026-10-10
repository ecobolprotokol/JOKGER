import { z } from 'zod';

export const opnameStatusSchema = z.enum(['draft', 'finalized']);
export const opnameSummarySchema = z.object({
  id: z.string().uuid(),
  status: opnameStatusSchema,
  opened_at: z.string(),
  finalized_at: z.string().nullable(),
  opened_by: z.string().uuid().nullable(),
  profiles: z.object({ full_name: z.string() }).nullable().optional(),
});
export const opnameLineSchema = z.object({
  inventory_item_id: z.string().uuid(),
  system_qty: z.coerce.number(),
  counted_qty: z.coerce.number().nullable(),
  inventory_items: z.object({
    name: z.string(),
    unit: z.string(),
    unit_cost: z.coerce.number().int(),
  }),
});
export const opnameDetailSchema = opnameSummarySchema.extend({
  stock_opname_lines: z.array(opnameLineSchema),
});
export const saveCountsSchema = z.array(
  z.object({
    inventory_item_id: z.string().uuid(),
    counted_qty: z.number().finite().min(0).max(999_999_999.999),
  }),
);

export type OpnameSummary = z.infer<typeof opnameSummarySchema>;
export type OpnameLine = z.infer<typeof opnameLineSchema>;
export type OpnameDetail = z.infer<typeof opnameDetailSchema>;
