create function apply_voucher(p_order_id uuid, p_code text)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_voucher vouchers;
  v_settings store_settings;
  v_subtotal bigint;
  v_discount bigint;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if v_order.voucher_id is not null then
    raise exception using errcode = 'P0001', message = 'VOUCHER_ALREADY_APPLIED';
  end if;
  if p_code is null or btrim(p_code) = '' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_voucher
  from vouchers
  where code = upper(btrim(p_code))
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

  select coalesce(sum(line_total), 0)::bigint into v_subtotal
  from order_items where order_id = v_order.id and not is_voided;
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

  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, v_discount, v_settings.service_percent,
    v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

  update vouchers set used_count = used_count + 1 where id = v_voucher.id;
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
  where id = v_order.id
  returning * into v_order;
  insert into voucher_redemptions (voucher_id, order_id, discount)
  values (v_voucher.id, v_order.id, v_discount);
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'voucher.apply', 'orders', v_order.id::text,
    jsonb_build_object('code', v_voucher.code, 'discount', v_discount)
  );
  return v_order;
end;
$$;

create function remove_voucher(p_order_id uuid, p_reason text)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_voucher_id uuid;
  v_settings store_settings;
  v_subtotal bigint;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 200 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if v_order.voucher_id is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  v_voucher_id := v_order.voucher_id;
  perform 1 from vouchers where id = v_voucher_id for update;
  delete from voucher_redemptions where order_id = v_order.id;
  update vouchers set used_count = greatest(used_count - 1, 0) where id = v_voucher_id;

  select coalesce(sum(line_total), 0)::bigint into v_subtotal
  from order_items where order_id = v_order.id and not is_voided;
  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, 0, v_settings.service_percent,
    v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

  update orders
  set subtotal = v_subtotal,
      discount_total = 0,
      service_amount = v_service,
      tax_amount = v_tax,
      rounding_amount = v_rounding,
      grand_total = v_grand_total,
      voucher_id = null,
      voucher_code = null,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'voucher.remove', 'orders', v_order.id::text,
    jsonb_build_object('voucher_id', v_voucher_id, 'reason', btrim(p_reason))
  );
  return v_order;
end;
$$;

revoke all on function apply_voucher(uuid, text) from public, anon;
revoke all on function remove_voucher(uuid, text) from public, anon;
grant execute on function apply_voucher(uuid, text) to authenticated;
grant execute on function remove_voucher(uuid, text) to authenticated;