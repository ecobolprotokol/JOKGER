create function add_items_to_open_bill(p_order_id uuid, p_items jsonb)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_shift shifts;
  v_settings store_settings;
  v_voucher vouchers;
  v_menu menu_items;
  v_item jsonb;
  v_recipe record;
  v_inventory inventory_items;
  v_item_id uuid;
  v_qty int;
  v_note text;
  v_option_ids uuid[];
  v_option_count int;
  v_modifier_extra bigint;
  v_modifiers jsonb;
  v_line_total bigint;
  v_order_item_id uuid;
  v_subtotal bigint;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_order_id is null or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.bill_state is distinct from 'open' then
    raise exception using errcode = 'P0001', message = 'BILL_CLOSED';
  end if;
  select * into v_shift from shifts where id = v_order.shift_id for update;
  if not found or v_shift.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'SHIFT_NOT_OPEN';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or v_item - array['menu_item_id', 'qty', 'modifier_option_ids', 'note']::text[] <> '{}'::jsonb
      or not (v_item ? 'menu_item_id') or not (v_item ? 'qty')
      or jsonb_typeof(v_item->'menu_item_id') <> 'string'
      or (v_item->>'qty') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty not between 1 and 100 then
      raise exception using errcode = 'P0001', message = 'ITEM_QUANTITY_INVALID';
    end if;
    v_item_id := (v_item->>'menu_item_id')::uuid;
    v_note := nullif(v_item->>'note', '');
    if length(v_note) > 140 then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;

    select * into v_menu from menu_items where id = v_item_id and is_active and is_available;
    if not found then
      raise exception using errcode = 'P0001', message = 'MENU_ITEM_UNAVAILABLE';
    end if;

    if v_item ? 'modifier_option_ids' then
      if jsonb_typeof(v_item->'modifier_option_ids') <> 'array' then
        raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
      end if;
      select coalesce(array_agg(option_id::uuid), array[]::uuid[])
      into v_option_ids
      from jsonb_array_elements_text(v_item->'modifier_option_ids') option_id;
    else
      v_option_ids := array[]::uuid[];
    end if;

    select count(distinct option_id)::int into v_option_count from unnest(v_option_ids) option_id;
    if v_option_count <> cardinality(v_option_ids) then
      raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
    end if;
    select coalesce(sum(option.extra_price), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'group', modifier_group.name,
        'name', option.name,
        'extra_price', option.extra_price
      ) order by modifier_group.name, option.name), '[]'::jsonb)
    into v_modifier_extra, v_modifiers
    from modifier_options option
    join modifier_groups modifier_group on modifier_group.id = option.group_id
    join menu_item_modifier_groups link on link.group_id = modifier_group.id
    where link.menu_item_id = v_item_id and option.is_active and option.id = any(v_option_ids);

    if v_option_count <> 0 and v_option_count <> (
      select count(*)::int
      from modifier_options option
      join menu_item_modifier_groups link on link.group_id = option.group_id
      where link.menu_item_id = v_item_id and option.is_active and option.id = any(v_option_ids)
    ) then
      raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
    end if;

    if exists (
      select 1
      from menu_item_modifier_groups link
      join modifier_groups modifier_group on modifier_group.id = link.group_id
      where link.menu_item_id = v_item_id
        and (select count(*) from modifier_options option
          where option.group_id = modifier_group.id and option.is_active and option.id = any(v_option_ids))
          not between modifier_group.min_select and modifier_group.max_select
    ) then
      raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
    end if;

    v_line_total := (v_menu.price + v_modifier_extra) * v_qty;
    v_order_item_id := gen_random_uuid();
    insert into order_items (
      id, order_id, menu_item_id, item_name, unit_price, modifiers, qty, line_total, note
    ) values (
      v_order_item_id, v_order.id, v_menu.id, v_menu.name, v_menu.price,
      v_modifiers, v_qty, v_line_total, v_note
    );

    for v_recipe in
      select inventory_item_id, qty_per_serving * v_qty as qty_used
      from recipe_lines where menu_item_id = v_menu.id order by inventory_item_id
    loop
      select * into v_inventory from inventory_items where id = v_recipe.inventory_item_id for update;
      if v_inventory.current_qty < v_recipe.qty_used then
        raise exception using errcode = 'P0001', message = 'STOCK_INSUFFICIENT';
      end if;
      update inventory_items
      set current_qty = current_qty - v_recipe.qty_used, updated_at = now()
      where id = v_recipe.inventory_item_id;
      insert into stock_movements (
        inventory_item_id, movement_type, qty_change, reference_type, reference_id, actor_id
      ) values (
        v_recipe.inventory_item_id, 'sale', -v_recipe.qty_used,
        'order_item', v_order_item_id::text, auth.uid()
      );
    end loop;
  end loop;

  select coalesce(sum(line_total), 0) into v_subtotal
  from order_items where order_id = v_order.id and not is_voided;
  if v_order.voucher_id is not null then
    select * into v_voucher from vouchers where id = v_order.voucher_id for update;
    if v_subtotal < v_voucher.min_subtotal then
      update vouchers set used_count = greatest(used_count - 1, 0) where id = v_voucher.id;
      delete from voucher_redemptions where order_id = v_order.id;
      v_order.voucher_id := null;
      v_order.voucher_code := null;
      v_order.discount_total := 0;
    end if;
  end if;

  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, v_order.discount_total, v_settings.service_percent,
    v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

  update orders
  set subtotal = v_subtotal,
      discount_total = v_order.discount_total,
      service_amount = v_service,
      tax_amount = v_tax,
      rounding_amount = v_rounding,
      grand_total = v_grand_total,
      voucher_id = v_order.voucher_id,
      voucher_code = v_order.voucher_code,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (auth.uid(), 'order.add_items', 'order', v_order.id::text,
    jsonb_build_object('order_no', v_order.order_no, 'subtotal', v_order.subtotal));
  return v_order;
end;
$$;

create function void_order_item(p_item_id uuid, p_reason text)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item order_items;
  v_order orders;
  v_settings store_settings;
  v_voucher vouchers;
  v_recipe record;
  v_subtotal bigint;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_item_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 200 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select * into v_item from order_items where id = p_item_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
  end if;
  select * into v_order from orders where id = v_item.order_id for update;
  if v_order.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if v_item.is_voided then
    raise exception using errcode = 'P0001', message = 'ITEM_ALREADY_VOIDED';
  end if;

  update order_items
  set is_voided = true, void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
  where id = v_item.id;

  for v_recipe in
    select inventory_item_id, qty_per_serving * v_item.qty as qty_returned
    from recipe_lines where menu_item_id = v_item.menu_item_id order by inventory_item_id
  loop
    update inventory_items
    set current_qty = current_qty + v_recipe.qty_returned, updated_at = now()
    where id = v_recipe.inventory_item_id;
    insert into stock_movements (
      inventory_item_id, movement_type, qty_change, reference_type, reference_id, note, actor_id
    ) values (
      v_recipe.inventory_item_id, 'void_return', v_recipe.qty_returned,
      'order_item', v_item.id::text, btrim(p_reason), auth.uid()
    );
  end loop;

  select coalesce(sum(line_total), 0) into v_subtotal
  from order_items where order_id = v_order.id and not is_voided;
  if v_order.voucher_id is not null then
    select * into v_voucher from vouchers where id = v_order.voucher_id for update;
    if v_subtotal < v_voucher.min_subtotal then
      update vouchers set used_count = greatest(used_count - 1, 0) where id = v_voucher.id;
      delete from voucher_redemptions where order_id = v_order.id;
      v_order.voucher_id := null;
      v_order.voucher_code := null;
      v_order.discount_total := 0;
    end if;
  end if;

  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, v_order.discount_total, v_settings.service_percent,
    v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

  update orders
  set subtotal = v_subtotal,
      discount_total = v_order.discount_total,
      service_amount = v_service,
      tax_amount = v_tax,
      rounding_amount = v_rounding,
      grand_total = v_grand_total,
      voucher_id = v_order.voucher_id,
      voucher_code = v_order.voucher_code,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'order.void_item', 'order_item', v_item.id::text,
    jsonb_build_object('order_no', v_order.order_no, 'reason', btrim(p_reason), 'line_total', v_item.line_total)
  );
  return v_order;
end;
$$;

revoke all on function add_items_to_open_bill(uuid, jsonb) from public, anon;
revoke all on function void_order_item(uuid, text) from public, anon;
grant execute on function add_items_to_open_bill(uuid, jsonb) to authenticated;
grant execute on function void_order_item(uuid, text) to authenticated;
