create function record_stock_movement(
  p_item_id uuid,
  p_type text,
  p_qty numeric,
  p_note text,
  p_allow_negative boolean
)
returns stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item inventory_items;
  v_movement stock_movements;
  v_change numeric(14, 3);
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_item_id is null or p_qty is null or p_qty = 0 or p_type not in ('purchase', 'waste', 'adjustment') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_type in ('purchase', 'waste') and p_qty < 0 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_note is not null and length(p_note) > 200 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_allow_negative and (not is_super_admin() or p_note is null or length(btrim(p_note)) < 3) then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_type = 'waste' and (p_note is null or length(btrim(p_note)) < 3) then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;
  v_change := case when p_type = 'waste' then -p_qty else p_qty end;

  select * into v_item from inventory_items where id = p_item_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
  end if;
  if v_item.current_qty + v_change < 0 and not p_allow_negative then
    raise exception using errcode = 'P0001', message = 'STOCK_INSUFFICIENT';
  end if;

  update inventory_items
  set current_qty = current_qty + v_change, updated_at = now()
  where id = p_item_id;
  insert into stock_movements (
    inventory_item_id, movement_type, qty_change, note, actor_id
  ) values (
    p_item_id, p_type::movement_type, v_change, nullif(btrim(p_note), ''), auth.uid()
  ) returning * into v_movement;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'inventory.movement',
    'inventory_item',
    p_item_id::text,
    jsonb_build_object('movement_type', p_type, 'qty_change', v_change, 'note', p_note)
  );

  return v_movement;
end;
$$;

revoke all on function record_stock_movement(uuid, text, numeric, text, boolean) from public, anon;
grant execute on function record_stock_movement(uuid, text, numeric, text, boolean) to authenticated;
