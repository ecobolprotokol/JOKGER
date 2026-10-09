create function upsert_inventory_item(p_item jsonb)
returns inventory_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_unit text;
  v_min_qty numeric(14, 3);
  v_unit_cost bigint;
  v_is_active boolean;
  v_existing inventory_items;
  v_item inventory_items;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object'
    or p_item - array['id', 'name', 'unit', 'min_qty', 'unit_cost', 'is_active']::text[] <> '{}'::jsonb
    or not (p_item ? 'name') or not (p_item ? 'unit')
    or not (p_item ? 'min_qty') or not (p_item ? 'unit_cost') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  v_name := nullif(btrim(p_item->>'name'), '');
  v_unit := nullif(btrim(p_item->>'unit'), '');
  if v_name is null or length(v_name) > 80 or v_unit is null or length(v_unit) > 20
    or (p_item->>'min_qty') !~ '^\d+(\.\d{1,3})?$'
    or (p_item->>'unit_cost') !~ '^\d+$' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  v_min_qty := (p_item->>'min_qty')::numeric(14, 3);
  v_unit_cost := (p_item->>'unit_cost')::bigint;
  v_is_active := case
    when p_item ? 'is_active' then (p_item->>'is_active')::boolean
    else true
  end;
  if v_min_qty < 0 or v_unit_cost < 0 or v_unit_cost > 999999999 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if p_item ? 'id' and nullif(p_item->>'id', '') is not null then
    v_id := (p_item->>'id')::uuid;
    select * into v_existing from inventory_items where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
    end if;
    if v_existing.unit <> v_unit and exists (
      select 1 from stock_movements where inventory_item_id = v_id
    ) then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    update inventory_items
    set name = v_name,
        unit = v_unit,
        min_qty = v_min_qty,
        unit_cost = v_unit_cost,
        is_active = v_is_active,
        updated_at = now()
    where id = v_id
    returning * into v_item;
  else
    insert into inventory_items (name, unit, min_qty, unit_cost, is_active)
    values (v_name, v_unit, v_min_qty, v_unit_cost, v_is_active)
    returning * into v_item;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'inventory.item_update',
    'inventory_item',
    v_item.id::text,
    jsonb_build_object('name', v_item.name, 'unit', v_item.unit, 'min_qty', v_item.min_qty, 'unit_cost', v_item.unit_cost)
  );
  return v_item;
end;
$$;

revoke all on function upsert_inventory_item(jsonb) from public, anon;
grant execute on function upsert_inventory_item(jsonb) to authenticated;
