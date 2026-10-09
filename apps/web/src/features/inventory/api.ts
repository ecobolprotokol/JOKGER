import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const inventoryItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  current_qty: z.coerce.number(),
  min_qty: z.coerce.number(),
  unit_cost: z.coerce.number().int().nonnegative(),
  is_active: z.boolean(),
});
const inventoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(20),
  min_qty: z.number().finite().min(0).max(999_999_999.999),
  unit_cost: z.number().int().min(0).max(999_999_999),
  is_active: z.boolean().default(true),
});
const movementSchema = z.object({
  id: z.number().int(),
  inventory_item_id: z.string().uuid(),
  movement_type: z.enum([
    'purchase',
    'sale',
    'void_return',
    'cancel_return',
    'adjustment',
    'opname',
    'waste',
  ]),
  qty_change: z.coerce.number(),
  note: z.string().nullable(),
  created_at: z.string(),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type StockMovement = z.infer<typeof movementSchema>;
export type StockMovementInput = {
  itemId: string;
  type: 'purchase' | 'waste' | 'adjustment';
  quantity: number;
  note: string | null;
  allowNegative: boolean;
};
export type InventoryItemInput = z.input<typeof inventoryInputSchema>;

export async function readInventoryItems(): Promise<Result<InventoryItem[]>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_qty, min_qty, unit_cost, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = z.array(inventoryItemSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Daftar inventaris tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function recordStockMovement(
  input: StockMovementInput,
): Promise<Result<StockMovement>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('record_stock_movement', {
    p_item_id: input.itemId,
    p_type: input.type,
    p_qty: input.quantity,
    p_note: input.note,
    p_allow_negative: input.allowNegative,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = movementSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons pergerakan stok tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function upsertInventoryItem(
  input: InventoryItemInput,
): Promise<Result<InventoryItem>> {
  const parsedInput = inventoryInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('upsert_inventory_item', {
    p_item: {
      ...(parsedInput.data.id ? { id: parsedInput.data.id } : {}),
      name: parsedInput.data.name,
      unit: parsedInput.data.unit,
      min_qty: parsedInput.data.min_qty,
      unit_cost: parsedInput.data.unit_cost,
      is_active: parsedInput.data.is_active,
    },
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = inventoryItemSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons bahan inventaris tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}
