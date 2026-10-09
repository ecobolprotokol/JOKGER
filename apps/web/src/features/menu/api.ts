import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
});
const menuItemSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.coerce.number().int().nonnegative(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});
const groupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  min_select: z.number().int(),
  max_select: z.number().int(),
});
const optionSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string(),
  extra_price: z.coerce.number().int().nonnegative(),
});
const linkSchema = z.object({ menu_item_id: z.string().uuid(), group_id: z.string().uuid() });
const categoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  sort_order: z.number().int().min(0).max(2_147_483_647).default(0),
  is_active: z.boolean().default(true),
});
const menuItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).nullable(),
  price: z.number().int().min(0).max(999_999_999),
  image_url: z.string().trim().max(1000).nullable(),
  is_available: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(2_147_483_647).default(0),
  modifier_group_ids: z.array(z.string().uuid()).default([]),
});
const recipeInputSchema = z.object({
  menuItemId: z.string().uuid(),
  lines: z.array(
    z.object({
      inventory_item_id: z.string().uuid(),
      qty_per_serving: z.number().finite().positive().max(999_999_999.999),
    }),
  ),
});
const recipeLinesSchema = z.array(
  z.object({
    inventory_item_id: z.string().uuid(),
    qty_per_serving: z.coerce.number().positive(),
  }),
);

export type MenuCategory = z.infer<typeof categorySchema>;
export type ModifierOption = z.infer<typeof optionSchema>;
export type ModifierGroup = z.infer<typeof groupSchema> & { options: ModifierOption[] };
export type MenuItem = z.infer<typeof menuItemSchema> & { modifierGroups: ModifierGroup[] };
export type MenuCatalog = { categories: MenuCategory[]; items: MenuItem[] };
export type MenuCategoryInput = z.input<typeof categoryInputSchema>;
export type MenuItemInput = z.input<typeof menuItemInputSchema>;
export type RecipeInput = z.input<typeof recipeInputSchema>;
export type RecipeLine = z.infer<typeof recipeLinesSchema>[number];

async function readCatalog(includeInactive: boolean): Promise<Result<MenuCatalog>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }

  let categoryQuery = supabase
    .from('categories')
    .select('id, name, sort_order, is_active')
    .order('sort_order');
  let itemQuery = supabase
    .from('menu_items')
    .select(
      'id, category_id, name, description, price, image_url, is_available, is_active, sort_order',
    )
    .order('sort_order');
  if (!includeInactive) {
    categoryQuery = categoryQuery.eq('is_active', true);
    itemQuery = itemQuery.eq('is_active', true);
  }

  const [categoryResult, itemResult, linkResult, groupResult, optionResult] = await Promise.all([
    categoryQuery,
    itemQuery,
    supabase.from('menu_item_modifier_groups').select('menu_item_id, group_id'),
    supabase.from('modifier_groups').select('id, name, min_select, max_select'),
    supabase
      .from('modifier_options')
      .select('id, group_id, name, extra_price')
      .eq('is_active', true),
  ]);

  const failed = [
    categoryResult.error,
    itemResult.error,
    linkResult.error,
    groupResult.error,
    optionResult.error,
  ].find((error) => error !== null);
  if (failed) {
    return { ok: false, error: toAppError(failed) };
  }

  const categories = z.array(categorySchema).safeParse(categoryResult.data);
  const items = z.array(menuItemSchema).safeParse(itemResult.data);
  const links = z.array(linkSchema).safeParse(linkResult.data);
  const groups = z.array(groupSchema).safeParse(groupResult.data);
  const options = z.array(optionSchema).safeParse(optionResult.data);
  if (
    !categories.success ||
    !items.success ||
    !links.success ||
    !groups.success ||
    !options.success
  ) {
    return { ok: false, error: toAppError(new Error('Katalog menu tidak valid.')) };
  }

  const itemGroups = new Map<string, string[]>();
  for (const link of links.data) {
    const current = itemGroups.get(link.menu_item_id) ?? [];
    current.push(link.group_id);
    itemGroups.set(link.menu_item_id, current);
  }
  const menuGroups = new Map(
    groups.data.map((group) => [
      group.id,
      {
        ...group,
        options: options.data.filter((option) => option.group_id === group.id),
      },
    ]),
  );

  return {
    ok: true,
    data: {
      categories: categories.data,
      items: items.data.map((item) => ({
        ...item,
        modifierGroups: (itemGroups.get(item.id) ?? [])
          .map((groupId) => menuGroups.get(groupId))
          .filter((group): group is ModifierGroup => group !== undefined),
      })),
    },
  };
}

export function readMenuCatalog(): Promise<Result<MenuCatalog>> {
  return readCatalog(false);
}

export function readMenuManagementCatalog(): Promise<Result<MenuCatalog>> {
  return readCatalog(true);
}

export async function readMenuRecipe(menuItemId: string): Promise<Result<RecipeLine[]>> {
  if (!z.string().uuid().safeParse(menuItemId).success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase
    .from('recipe_lines')
    .select('inventory_item_id, qty_per_serving')
    .eq('menu_item_id', menuItemId);
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = recipeLinesSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Data resep tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function upsertCategory(input: MenuCategoryInput): Promise<Result<MenuCategory>> {
  const parsedInput = categoryInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('upsert_category', {
    p_category: parsedInput.data,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = categorySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons kategori tidak valid.')) };
  }
  return { ok: true, data: parsed.data };
}

export async function upsertMenuItem(input: MenuItemInput): Promise<Result<MenuItem>> {
  const parsedInput = menuItemInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('upsert_menu_item', {
    p_item: parsedInput.data,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = menuItemSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons menu tidak valid.')) };
  }
  return { ok: true, data: { ...parsed.data, modifierGroups: [] } };
}

export async function setMenuItemAvailable(
  itemId: string,
  available: boolean,
): Promise<Result<MenuItem>> {
  if (!z.string().uuid().safeParse(itemId).success || typeof available !== 'boolean') {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { data, error } = await supabase.rpc('set_menu_item_available', {
    p_item_id: itemId,
    p_available: available,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  const parsed = menuItemSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: toAppError(new Error('Respons ketersediaan menu tidak valid.')) };
  }
  return { ok: true, data: { ...parsed.data, modifierGroups: [] } };
}

export async function upsertRecipe(input: RecipeInput): Promise<Result<null>> {
  const parsedInput = recipeInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, error: toAppError({ code: 'INPUT_INVALID' }) };
  }
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }
  const { error } = await supabase.rpc('upsert_recipe', {
    p_menu_item_id: parsedInput.data.menuItemId,
    p_lines: parsedInput.data.lines,
  });
  if (error) {
    return { ok: false, error: toAppError(error) };
  }
  return { ok: true, data: null };
}
