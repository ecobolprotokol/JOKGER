create function close_open_bill(
  p_client_ref uuid,
  p_order_id uuid,
  p_payments jsonb,
  p_voucher_code text
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
  v_payment jsonb;
  v_method payment_method;
  v_amount bigint;
  v_received bigint;
  v_change bigint;
  v_account_id uuid;
  v_reference text;
  v_proof_path text;
  v_subtotal bigint;
  v_discount bigint := 0;
  v_service bigint;
  v_tax bigint;
  v_rounding bigint;
  v_grand_total bigint;
  v_payment_total bigint := 0;
  v_apply_new_voucher boolean := false;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_client_ref is null or p_order_id is null or p_payments is null
    or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  insert into client_requests (client_ref, rpc_name)
  values (p_client_ref, 'close_open_bill')
  on conflict (client_ref) do nothing;

  if not found then
    if not exists (
      select 1 from client_requests
      where client_ref = p_client_ref and rpc_name = 'close_open_bill'
    ) then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    select * into v_order
    from orders
    where id = (select result_id from client_requests where client_ref = p_client_ref);
    if not found then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    return v_order;
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

  select coalesce(sum(line_total), 0) into v_subtotal
  from order_items
  where order_id = v_order.id and not is_voided;
  if v_subtotal = 0 then
    raise exception using errcode = 'P0001', message = 'BILL_EMPTY';
  end if;

  if p_voucher_code is not null and btrim(p_voucher_code) <> '' then
    if v_order.voucher_id is not null then
      raise exception using errcode = 'P0001', message = 'VOUCHER_ALREADY_APPLIED';
    end if;
    select * into v_voucher
    from vouchers
    where code = upper(btrim(p_voucher_code))
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_FOUND';
    end if;
    v_apply_new_voucher := true;
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
  elsif v_order.voucher_id is not null then
    select * into v_voucher from vouchers where id = v_order.voucher_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_FOUND';
    end if;
    if v_subtotal < v_voucher.min_subtotal then
      update vouchers set used_count = greatest(used_count - 1, 0) where id = v_voucher.id;
      delete from voucher_redemptions where order_id = v_order.id;
      v_order.voucher_id := null;
      v_order.voucher_code := null;
    else
      v_discount := v_order.discount_total;
    end if;
  end if;

  select * into v_settings from store_settings where id = 1;
  select totals.service_amount, totals.tax_amount, totals.rounding_amount, totals.grand_total
  into v_service, v_tax, v_rounding, v_grand_total
  from calculate_order_totals(
    v_subtotal, v_discount, v_settings.service_percent, v_settings.tax_percent, v_settings.rounding_rule
  ) totals;

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
    v_payment_total := v_payment_total + v_amount;
    v_method := (v_payment->>'method')::payment_method;
    v_account_id := nullif(v_payment->>'payment_account_id', '')::uuid;
    v_received := nullif(v_payment->>'received_amount', '')::bigint;
    v_reference := nullif(btrim(v_payment->>'reference_no'), '');
    v_proof_path := nullif(v_payment->>'proof_path', '');

    if v_method = 'cash' then
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
      change_amount, status, reference_no, proof_path, created_by, verified_by, verified_at
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

  if v_payment_total <> v_grand_total then
    if v_payment_total > v_grand_total then
      raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_OUTSTANDING';
    end if;
    raise exception using errcode = 'P0001', message = 'CASH_RECEIVED_INSUFFICIENT';
  end if;

  update orders
  set bill_state = 'closed',
      closed_at = now(),
      subtotal = v_subtotal,
      discount_total = v_discount,
      service_amount = v_service,
      tax_amount = v_tax,
      rounding_amount = v_rounding,
      grand_total = v_grand_total,
      voucher_id = v_order.voucher_id,
      voucher_code = v_order.voucher_code,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  if v_apply_new_voucher then
    update orders set voucher_id = v_voucher.id, voucher_code = v_voucher.code
    where id = v_order.id returning * into v_order;
    update vouchers set used_count = used_count + 1 where id = v_voucher.id;
    insert into voucher_redemptions (voucher_id, order_id, discount)
    values (v_voucher.id, v_order.id, v_discount);
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'open_bill.close',
    'order',
    v_order.id::text,
    jsonb_build_object('order_no', v_order.order_no, 'grand_total', v_grand_total, 'payment_total', v_payment_total)
  );

  update client_requests set result_id = v_order.id where client_ref = p_client_ref;
  return v_order;
end;
$$;

revoke all on function close_open_bill(uuid, uuid, jsonb, text) from public, anon;
grant execute on function close_open_bill(uuid, uuid, jsonb, text) to authenticated;
