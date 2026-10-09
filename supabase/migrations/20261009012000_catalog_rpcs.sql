create function upsert_category(p_category jsonb)
returns categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_sort_order integer;
  v_is_active boolean;
  v_category categories;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_category is null or jsonb_typeof(p_category) <> 'object'
    or p_category - array['id', 'name', 'sort_order', 'is_active']::text[] <> '{}'::jsonb
    or not (p_category ? 'name') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  v_name := nullif(btrim(p_category->>'name'), '');
  if v_name is null or length(v_name) > 80
    or (p_category ? 'sort_order' and (p_category->>'sort_order') !~ '^\d{1,10}$')
    or (p_category ? 'is_active' and jsonb_typeof(p_category->'is_active') <> 'boolean')
    or (p_category ? 'id' and (p_category->>'id') !~ '^[0-9a-fA-F-]{36}$') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  v_sort_order := coalesce((p_category->>'sort_order')::integer, 0);
  v_is_active := coalesce((p_category->>'is_active')::boolean, true);
  if v_sort_order < 0 or exists (
    select 1 from categories
    where name = v_name and (not (p_category ? 'id') or id <> (p_category->>'id')::uuid)
  ) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if p_category ? 'id' then
    v_id := (p_category->>'id')::uuid;
    perform 1 from categories where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    update categories
    set name = v_name, sort_order = v_sort_order, is_active = v_is_active
    where id = v_id
    returning * into v_category;
  else
    insert into categories (name, sort_order, is_active)
    values (v_name, v_sort_order, v_is_active)
    returning * into v_category;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'menu.update', 'category', v_category.id::text,
    jsonb_build_object('name', v_category.name, 'is_active', v_category.is_active)
  );
  return v_category;
end;
$$;

create function upsert_menu_item(p_item jsonb)
returns menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category_id uuid;
  v_name text;
  v_description text;
  v_price bigint;
  v_image_url text;
  v_is_available boolean;
  v_is_active boolean;
  v_sort_order integer;
  v_existing menu_items;
  v_item menu_items;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object'
    or p_item - array[
      'id', 'category_id', 'name', 'description', 'price', 'image_url',
      'is_available', 'is_active', 'sort_order', 'modifier_group_ids'
    ]::text[] <> '{}'::jsonb
    or not (p_item ? 'category_id') or not (p_item ? 'name') or not (p_item ? 'price') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if (p_item->>'category_id') !~ '^[0-9a-fA-F-]{36}$'
    or (p_item ? 'id' and (p_item->>'id') !~ '^[0-9a-fA-F-]{36}$')
    or (p_item->>'price') !~ '^\d{1,9}$'
    or (p_item ? 'sort_order' and (p_item->>'sort_order') !~ '^\d{1,10}$')
    or (p_item ? 'is_available' and jsonb_typeof(p_item->'is_available') <> 'boolean')
    or (p_item ? 'is_active' and jsonb_typeof(p_item->'is_active') <> 'boolean')
    or (p_item ? 'description' and jsonb_typeof(p_item->'description') not in ('string', 'null'))
    or (p_item ? 'image_url' and jsonb_typeof(p_item->'image_url') not in ('string', 'null'))
    or (p_item ? 'modifier_group_ids' and jsonb_typeof(p_item->'modifier_group_ids') <> 'array') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  v_category_id := (p_item->>'category_id')::uuid;
  v_name := nullif(btrim(p_item->>'name'), '');
  v_description := nullif(btrim(p_item->>'description'), '');
  v_price := (p_item->>'price')::bigint;
  v_image_url := nullif(btrim(p_item->>'image_url'), '');
  v_is_available := coalesce((p_item->>'is_available')::boolean, true);
  v_is_active := coalesce((p_item->>'is_active')::boolean, true);
  v_sort_order := coalesce((p_item->>'sort_order')::integer, 0);

  if v_name is null or length(v_name) > 80
    or (v_description is not null and length(v_description) > 200)
    or (v_image_url is not null and length(v_image_url) > 1000)
    or v_sort_order < 0
    or not exists (select 1 from categories where id = v_category_id) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_item ? 'modifier_group_ids' and (
    exists (
      select 1 from jsonb_array_elements(p_item->'modifier_group_ids') as entry(value)
      where jsonb_typeof(entry.value) <> 'string'
        or entry.value #>> '{}' !~ '^[0-9a-fA-F-]{36}$'
    )
    or exists (
      select entry.value from jsonb_array_elements_text(p_item->'modifier_group_ids') as entry(value)
      group by entry.value having count(*) > 1
    )
    or (select count(*) from jsonb_array_elements_text(p_item->'modifier_group_ids')) <> (
      select count(*) from modifier_groups
      where id in (select value::uuid from jsonb_array_elements_text(p_item->'modifier_group_ids'))
    )
  ) then
    raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
  end if;

  if p_item ? 'id' then
    v_id := (p_item->>'id')::uuid;
    select * into v_existing from menu_items where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
    end if;
    update menu_items
    set category_id = v_category_id,
        name = v_name,
        description = v_description,
        price = v_price,
        image_url = v_image_url,
        is_available = v_is_available,
        is_active = v_is_active,
        sort_order = v_sort_order,
        updated_at = now()
    where id = v_id
    returning * into v_item;
  else
    insert into menu_items (
      category_id, name, description, price, image_url,
      is_available, is_active, sort_order
    ) values (
      v_category_id, v_name, v_description, v_price, v_image_url,
      v_is_available, v_is_active, v_sort_order
    ) returning * into v_item;
  end if;

  if p_item ? 'modifier_group_ids' then
    delete from menu_item_modifier_groups where menu_item_id = v_item.id;
    insert into menu_item_modifier_groups (menu_item_id, group_id)
    select v_item.id, value::uuid
    from jsonb_array_elements_text(p_item->'modifier_group_ids') as entry(value);
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'menu.update', 'menu_item', v_item.id::text,
    jsonb_build_object('name', v_item.name, 'is_active', v_item.is_active)
  );
  if v_existing.id is not null and v_existing.price <> v_item.price then
    insert into audit_logs (actor_id, action, entity, entity_id, payload)
    values (
      auth.uid(), 'menu.price_change', 'menu_item', v_item.id::text,
      jsonb_build_object('from', v_existing.price, 'to', v_item.price)
    );
  end if;
  return v_item;
end;
$$;

create function set_menu_item_available(p_item_id uuid, p_available boolean)
returns menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item menu_items;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_item_id is null or p_available is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  select * into v_item from menu_items where id = p_item_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
  end if;

  update menu_items
  set is_available = p_available, updated_at = now()
  where id = v_item.id
  returning * into v_item;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'menu.update', 'menu_item', v_item.id::text,
    jsonb_build_object('is_available', p_available)
  );
  return v_item;
end;
$$;

create function upsert_recipe(p_menu_item_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_item_name text;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_menu_item_id is null or p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or not exists (select 1 from menu_items where id = p_menu_item_id for update) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
      or v_line - array['inventory_item_id', 'qty_per_serving']::text[] <> '{}'::jsonb
      or not (v_line ? 'inventory_item_id') or not (v_line ? 'qty_per_serving')
      or (v_line->>'inventory_item_id') !~ '^[0-9a-fA-F-]{36}$'
      or (v_line->>'qty_per_serving') !~ '^\d+(\.\d{1,3})?$'
      or (v_line->>'qty_per_serving')::numeric <= 0 then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
  end loop;

  if exists (
    select value->>'inventory_item_id'
    from jsonb_array_elements(p_lines) as entry(value)
    group by value->>'inventory_item_id' having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_lines) as entry(value)
    left join inventory_items item on item.id = (entry.value->>'inventory_item_id')::uuid
    where item.id is null or not item.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  delete from recipe_lines where menu_item_id = p_menu_item_id;
  insert into recipe_lines (menu_item_id, inventory_item_id, qty_per_serving)
  select
    p_menu_item_id,
    (value->>'inventory_item_id')::uuid,
    (value->>'qty_per_serving')::numeric
  from jsonb_array_elements(p_lines) as entry(value);

  select name into v_item_name from menu_items where id = p_menu_item_id;
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'menu.update', 'recipe', p_menu_item_id::text,
    jsonb_build_object('menu_item_name', v_item_name, 'line_count', jsonb_array_length(p_lines))
  );
end;
$$;

revoke all on function upsert_category(jsonb) from public, anon;
revoke all on function upsert_menu_item(jsonb) from public, anon;
revoke all on function set_menu_item_available(uuid, boolean) from public, anon;
revoke all on function upsert_recipe(uuid, jsonb) from public, anon;
grant execute on function upsert_category(jsonb) to authenticated;
grant execute on function upsert_menu_item(jsonb) to authenticated;
grant execute on function set_menu_item_available(uuid, boolean) to authenticated;
grant execute on function upsert_recipe(uuid, jsonb) to authenticated;