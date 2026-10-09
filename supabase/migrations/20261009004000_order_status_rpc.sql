create function change_order_status(p_order_id uuid, p_to_status order_status)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_shift shifts;
  v_settings store_settings;
  v_verified bigint;
  v_from_status order_status;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_order_id is null or p_to_status is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  v_from_status := v_order.status;

  if not (
    (v_order.status = 'new' and p_to_status = 'processing')
    or (v_order.status = 'processing' and p_to_status = 'ready')
    or (v_order.status = 'ready' and p_to_status in ('processing', 'completed'))
  ) then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;

  if v_order.status = 'new' and p_to_status = 'processing' then
    select * into v_shift from shifts where id = v_order.shift_id for update;
    if not found or v_shift.status <> 'open' then
      raise exception using errcode = 'P0001', message = 'SHIFT_NOT_OPEN';
    end if;
  end if;

  if p_to_status = 'completed' then
    if v_order.bill_state = 'open' then
      raise exception using errcode = 'P0001', message = 'BILL_NOT_CLOSED';
    end if;
    select * into v_settings from store_settings where id = 1;
    select coalesce(sum(amount), 0) into v_verified
    from payments
    where order_id = v_order.id
      and status = 'verified'
      and not is_refund;
    if v_settings.require_verified_payment and v_verified < v_order.grand_total then
      raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_VERIFIED';
    end if;
  end if;

  update orders
  set status = p_to_status,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'order.status_change',
    'order',
    v_order.id::text,
    jsonb_build_object('from', v_from_status, 'to', p_to_status, 'order_no', v_order.order_no)
  );

  return v_order;
end;
$$;

revoke all on function change_order_status(uuid, order_status) from public, anon;
grant execute on function change_order_status(uuid, order_status) to authenticated;
