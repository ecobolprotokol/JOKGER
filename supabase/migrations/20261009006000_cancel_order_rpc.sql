create function cancel_order(p_order_id uuid, p_reason text)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_item record;
  v_recipe record;
  v_payment payments;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_order_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 200 then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('new', 'processing') then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_CANCELLABLE';
  end if;

  for v_item in
    select id, menu_item_id, qty
    from order_items
    where order_id = v_order.id and not is_voided
    for update
  loop
    for v_recipe in
      select inventory_item_id, qty_per_serving * v_item.qty as qty_returned
      from recipe_lines
      where menu_item_id = v_item.menu_item_id
      order by inventory_item_id
    loop
      update inventory_items
      set current_qty = current_qty + v_recipe.qty_returned, updated_at = now()
      where id = v_recipe.inventory_item_id;
      insert into stock_movements (
        inventory_item_id, movement_type, qty_change, reference_type, reference_id, note, actor_id
      ) values (
        v_recipe.inventory_item_id,
        'cancel_return',
        v_recipe.qty_returned,
        'order_item',
        v_item.id::text,
        btrim(p_reason),
        auth.uid()
      );
    end loop;
  end loop;

  if v_order.voucher_id is not null then
    update vouchers
    set used_count = greatest(used_count - 1, 0)
    where id = v_order.voucher_id;
    delete from voucher_redemptions where order_id = v_order.id;
  end if;

  for v_payment in
    select * from payments
    where order_id = v_order.id and status = 'verified' and not is_refund
    for update
  loop
    insert into payments (
      order_id, shift_id, method, payment_account_id, amount, change_amount,
      is_refund, status, note, created_by, verified_by, verified_at
    ) values (
      v_order.id,
      v_payment.shift_id,
      v_payment.method,
      v_payment.payment_account_id,
      -v_payment.amount,
      0,
      true,
      'verified',
      btrim(p_reason),
      auth.uid(),
      auth.uid(),
      now()
    );
    insert into audit_logs (actor_id, action, entity, entity_id, payload)
    values (
      auth.uid(),
      'payment.refund',
      'payment',
      v_payment.id::text,
      jsonb_build_object('order_no', v_order.order_no, 'amount', -v_payment.amount, 'method', v_payment.method)
    );
  end loop;

  update orders
  set status = 'cancelled',
      cancelled_from = v_order.status,
      cancel_reason = btrim(p_reason),
      voucher_id = null,
      voucher_code = null,
      discount_total = 0,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'order.cancel',
    'order',
    v_order.id::text,
    jsonb_build_object('order_no', v_order.order_no, 'reason', btrim(p_reason), 'cancelled_from', v_order.cancelled_from)
  );
  return v_order;
end;
$$;

revoke all on function cancel_order(uuid, text) from public, anon;
grant execute on function cancel_order(uuid, text) to authenticated;
