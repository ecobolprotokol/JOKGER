import { z } from 'zod';
import { toAppError, type Result } from '../../shared/lib/errors';
import { supabase } from '../../shared/lib/supabase';

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sort_order: z.number().int(),
});
const menuItemSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.coerce.number().int().nonnegative(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
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

export type MenuCategory = z.infer<typeof categorySchema>;
export type ModifierOption = z.infer<typeof optionSchema>;
export type ModifierGroup = z.infer<typeof groupSchema> & { options: ModifierOption[] };
export type MenuItem = z.infer<typeof menuItemSchema> & { modifierGroups: ModifierGroup[] };
export type MenuCatalog = { categories: MenuCategory[]; items: MenuItem[] };

export async function readMenuCatalog(): Promise<Result<MenuCatalog>> {
  if (!supabase) {
    return { ok: false, error: toAppError({ code: 'SERVER_NOT_CONFIGURED' }) };
  }

  const [categoryResult, itemResult, linkResult, groupResult, optionResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('menu_items')
      .select('id, category_id, name, description, price, image_url, is_available, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
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
