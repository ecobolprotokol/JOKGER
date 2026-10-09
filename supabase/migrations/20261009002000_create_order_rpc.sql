create function calculate_order_totals(
  p_subtotal bigint,
  p_discount bigint,
  p_service_percent numeric,
  p_tax_percent numeric,
  p_rounding_rule text
)
returns table (
  subtotal bigint,
  discount_total bigint,
  service_amount bigint,
  tax_amount bigint,
  rounding_amount bigint,
  grand_total bigint
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base bigint;
  v_pre_round bigint;
begin
  if p_subtotal < 0 or p_discount < 0 or p_service_percent not between 0 and 100
    or p_tax_percent not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  subtotal := p_subtotal;
  discount_total := least(p_discount, p_subtotal);
  v_base := p_subtotal - discount_total;
  service_amount := floor(v_base * p_service_percent / 100 + 0.5)::bigint;
  tax_amount := floor((v_base + service_amount) * p_tax_percent / 100 + 0.5)::bigint;
  v_pre_round := v_base + service_amount + tax_amount;

  if p_rounding_rule = 'up_100' then
    grand_total := ceil(v_pre_round::numeric / 100)::bigint * 100;
  elsif p_rounding_rule = 'nearest_100' then
    grand_total := floor((v_pre_round + 50)::numeric / 100)::bigint * 100;
  elsif p_rounding_rule = 'none' then
    grand_total := v_pre_round;
  else
    raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID';
  end if;

  rounding_amount := grand_total - v_pre_round;
  return next;
end;
$$;

create function create_order(
  p_client_ref uuid,
  p_order_type order_type,
  p_items jsonb,
  p_voucher_code text,
  p_table_label text,
  p_customer_name text,
  p_bill_mode text,
  p_payments jsonb
)
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
  v_order_id uuid := gen_random_uuid();
  v_day date := (now() at time zone 'Asia/Jakarta')::date;
  v_sequence int;
  v_order_no text;
  v_item jsonb;
  v_payment jsonb;
  v_menu menu_items;
  v_group record;
  v_inventory inventory_items;
  v_recipe record;
  v_item_id uuid;
  v_order_item_id uuid;
  v_qty int;
  v_note text;
  v_option_ids uuid[];
  v_option_count int;
  v_modifier_extra bigint;
  v_modifiers jsonb;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
  v_paid_total bigint := 0;
  v_amount bigint;
  v_received bigint;
  v_change bigint;
  v_method payment_method;
  v_account_id uuid;
  v_reference text;
  v_proof_path text;
  v_cash_present boolean := false;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;

  if p_client_ref is null or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 or p_bill_mode not in ('none', 'open')
    or p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  insert into client_requests (client_ref, rpc_name)
  values (p_client_ref, 'create_order')
  on conflict (client_ref) do nothing;

  if not found then
    if not exists (
      select 1 from client_requests
      where client_ref = p_client_ref and rpc_name = 'create_order'
    ) then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    select * into v_order
    from orders
    where id = (
      select result_id from client_requests where client_ref = p_client_ref
    );
    if not found then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    return v_order;
  end if;

  select * into v_shift
  from shifts
  where status = 'open'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SHIFT_NOT_OPEN';
  end if;

  if p_bill_mode = 'open' and jsonb_array_length(p_payments) > 0 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  insert into daily_sequences (day, last_no)
  values (v_day, 1)
  on conflict (day) do update set last_no = daily_sequences.last_no + 1
  returning last_no into v_sequence;
  v_order_no := 'JKG-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_sequence::text, 4, '0');

  insert into orders (
    id, order_no, shift_id, order_type, bill_state, table_label, customer_name, created_by
  ) values (
    v_order_id,
    v_order_no,
    v_shift.id,
    p_order_type,
    case when p_bill_mode = 'open' then 'open'::bill_state else null end,
    nullif(btrim(p_table_label), ''),
    nullif(btrim(p_customer_name), ''),
    auth.uid()
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or v_item - array['menu_item_id', 'qty', 'modifier_option_ids', 'note']::text[] <> '{}'::jsonb
      or not (v_item ? 'menu_item_id') or not (v_item ? 'qty')
      or jsonb_typeof(v_item->'menu_item_id') <> 'string'
      or jsonb_typeof(v_item->'qty') <> 'number'
      or (v_item->>'qty') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;

    if (v_item->>'qty')::int not between 1 and 100 then
      raise exception using errcode = 'P0001', message = 'ITEM_QUANTITY_INVALID';
    end if;
    v_qty := (v_item->>'qty')::int;
    v_item_id := (v_item->>'menu_item_id')::uuid;
    v_note := nullif(v_item->>'note', '');
    if length(v_note) > 140 then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;

    select * into v_menu
    from menu_items
    where id = v_item_id and is_active and is_available;
    if not found then
      raise exception using errcode = 'P0001', message = 'MENU_ITEM_UNAVAILABLE';
    end if;

    if v_item ? 'modifier_option_ids' then
      if jsonb_typeof(v_item->'modifier_option_ids') <> 'array'
        or exists (
          select 1 from jsonb_array_elements(v_item->'modifier_option_ids') option_id
          where jsonb_typeof(option_id) <> 'string'
        ) then
        raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
      end if;
      select coalesce(array_agg(option_id::uuid), array[]::uuid[])
      into v_option_ids
      from jsonb_array_elements_text(v_item->'modifier_option_ids') option_id;
    else
      v_option_ids := array[]::uuid[];
    end if;

    select count(distinct option_id)::int into v_option_count
    from unnest(v_option_ids) option_id;
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
    where link.menu_item_id = v_item_id
      and option.is_active
      and option.id = any(v_option_ids);

    if v_option_count <> 0 and (
      select count(*) from modifier_options option
      join menu_item_modifier_groups link on link.group_id = option.group_id
      where link.menu_item_id = v_item_id
        and option.is_active
        and option.id = any(v_option_ids)
    ) <> v_option_count then
      raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
    end if;

    for v_group in
      select modifier_group.id, modifier_group.min_select, modifier_group.max_select
      from menu_item_modifier_groups link
      join modifier_groups modifier_group on modifier_group.id = link.group_id
      where link.menu_item_id = v_item_id
    loop
      select count(*)::int into v_option_count
      from modifier_options option
      where option.group_id = v_group.id
        and option.is_active
        and option.id = any(v_option_ids);
      if v_option_count < v_group.min_select or v_option_count > v_group.max_select then
        raise exception using errcode = 'P0001', message = 'MODIFIER_INVALID';
      end if;
    end loop;

    v_line_total := (v_menu.price + v_modifier_extra) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_order_item_id := gen_random_uuid();
    insert into order_items (
      id, order_id, menu_item_id, item_name, unit_price, modifiers, qty, line_total, note
    ) values (
      v_order_item_id, v_order_id, v_menu.id, v_menu.name, v_menu.price,
      v_modifiers, v_qty, v_line_total, v_note
    );

    for v_recipe in
      select inventory_item_id, qty_per_serving * v_qty as qty_used
      from recipe_lines
      where menu_item_id = v_menu.id
      order by inventory_item_id
    loop
      select * into v_inventory
      from inventory_items
      where id = v_recipe.inventory_item_id
      for update;
      if v_inventory.current_qty < v_recipe.qty_used then
        raise exception using errcode = 'P0001', message = 'STOCK_INSUFFICIENT';
      end if;
      update inventory_items
      set current_qty = current_qty - v_recipe.qty_used, updated_at = now()
      where id = v_recipe.inventory_item_id;
      insert into stock_movements (
        inventory_item_id, movement_type, qty_change, reference_type, reference_id, actor_id
      ) values (
        v_recipe.inventory_item_id,
        'sale',
        -v_recipe.qty_used,
        'order_item',
        v_order_item_id::text,
        auth.uid()
      );
    end loop;
  end loop;

  if p_voucher_code is not null and btrim(p_voucher_code) <> '' then
    select * into v_voucher
    from vouchers
    where code = upper(btrim(p_voucher_code))
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_FOUND';
    end if;
    if not v_voucher.is_active then
      raise exception using errcode = 'P0001', message = 'VOUCHER_INACTIVE';
    end if;
    if now() < v_voucher.valid_from then
      raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_STARTED';
    end if;
    if now() > v_voucher.valid_until then
      raise exception using errcode = 'P0001', message = 'VOUCHER_EXPIRED';
    end if;
    if v_voucher.total_quota is not null and v_voucher.used_count >= v_voucher.total_quota then
      raise exception using errcode = 'P0001', message = 'VOUCHER_QUOTA_EXCEEDED';
    end if;
    if v_subtotal < v_voucher.min_subtotal then
      raise exception using errcode = 'P0001', message = 'VOUCHER_MIN_SUBTOTAL';
    end if;
    if v_voucher.type = 'percent' then
      v_discount := floor(v_subtotal * v_voucher.value / 100.0 + 0.5)::bigint;
      if v_voucher.max_discount is not null then
        v_discount := least(v_discount, v_voucher.max_discount);
      end if;
    else
      v_discount := least(v_voucher.value, v_subtotal);
    end if;
    v_discount := least(v_discount, v_subtotal);
    update vouchers set used_count = used_count + 1 where id = v_voucher.id;
  end if;

  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, v_discount, v_settings.service_percent, v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

  update orders
  set subtotal = v_subtotal,
      discount_total = v_discount,
      service_amount = v_service,
      tax_amount = v_tax,
      rounding_amount = v_rounding,
      grand_total = v_grand_total,
      voucher_id = v_voucher.id,
      voucher_code = v_voucher.code,
      updated_at = now()
  where id = v_order_id
  returning * into v_order;

  if v_voucher.id is not null then
    insert into voucher_redemptions (voucher_id, order_id, discount)
    values (v_voucher.id, v_order.id, v_discount);
  end if;

  if jsonb_array_length(p_payments) > 0 then
    if p_bill_mode <> 'none' then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    for v_payment in select value from jsonb_array_elements(p_payments)
    loop
      if jsonb_typeof(v_payment) <> 'object'
        or v_payment - array['method', 'amount', 'received_amount', 'payment_account_id', 'reference_no', 'proof_path']::text[] <> '{}'::jsonb
        or not (v_payment ? 'method') or not (v_payment ? 'amount')
        or (v_payment->>'amount') !~ '^[0-9]+$' then
        raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
      end if;
      v_amount := (v_payment->>'amount')::bigint;
      if v_amount <= 0 then
        raise exception using errcode = 'P0001', message = 'PAYMENT_AMOUNT_INVALID';
      end if;
      v_paid_total := v_paid_total + v_amount;
      v_method := (v_payment->>'method')::payment_method;
      v_account_id := nullif(v_payment->>'payment_account_id', '')::uuid;
      v_received := nullif(v_payment->>'received_amount', '')::bigint;
      v_reference := nullif(btrim(v_payment->>'reference_no'), '');
      v_proof_path := nullif(v_payment->>'proof_path', '');

      if v_method = 'cash' then
        v_cash_present := true;
        if v_account_id is not null then
          raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
        end if;
        if v_received is null or v_received < v_amount then
          raise exception using errcode = 'P0001', message = 'CASH_RECEIVED_INSUFFICIENT';
        end if;
        v_change := v_received - v_amount;
      else
        if v_account_id is null or v_reference !~ '^[A-Za-z0-9]{4,40}$'
          or not exists (
            select 1 from payment_accounts
            where id = v_account_id and is_active and method = v_method
          ) then
          raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
        end if;
        v_change := 0;
      end if;

      insert into payments (
        order_id, shift_id, method, payment_account_id, amount, received_amount,
        change_amount, status, reference_no, proof_path, created_by,
        verified_by, verified_at
      ) values (
        v_order.id,
        v_shift.id,
        v_method,
        v_account_id,
        v_amount,
        v_received,
        v_change,
        case when v_method = 'cash' then 'verified'::payment_status else 'pending_verification'::payment_status end,
        v_reference,
        v_proof_path,
        auth.uid(),
        case when v_method = 'cash' then auth.uid() else null end,
        case when v_method = 'cash' then now() else null end
      );
    end loop;

    if v_paid_total > v_grand_total then
      raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_OUTSTANDING';
    elsif v_paid_total < v_grand_total then
      raise exception using errcode = 'P0001', message = 'CASH_RECEIVED_INSUFFICIENT';
    end if;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'order.create',
    'order',
    v_order.id::text,
    jsonb_build_object(
      'order_no', v_order.order_no,
      'grand_total', v_order.grand_total,
      'bill_mode', p_bill_mode,
      'payment_total', v_paid_total,
      'cash_present', v_cash_present
    )
  );

  update client_requests
  set result_id = v_order.id
  where client_ref = p_client_ref;

  return v_order;
end;
$$;

revoke all on function calculate_order_totals(bigint, bigint, numeric, numeric, text) from public, anon;
revoke all on function create_order(uuid, order_type, jsonb, text, text, text, text, jsonb) from public, anon;
grant execute on function calculate_order_totals(bigint, bigint, numeric, numeric, text) to authenticated;
grant execute on function create_order(uuid, order_type, jsonb, text, text, text, text, jsonb) to authenticated;
