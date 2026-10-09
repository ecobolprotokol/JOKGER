create function open_stock_opname()
returns stock_opnames
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opname stock_opnames;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  perform pg_advisory_xact_lock(hashtext('jokger.stock_opname'));
  if exists (select 1 from stock_opnames where status = 'draft') then
    raise exception using errcode = 'P0001', message = 'OPNAME_ALREADY_DRAFT';
  end if;

  insert into stock_opnames (opened_by)
  values (auth.uid())
  returning * into v_opname;
  insert into stock_opname_lines (opname_id, inventory_item_id, system_qty)
  select v_opname.id, id, current_qty
  from inventory_items
  where is_active;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'opname.open',
    'stock_opname',
    v_opname.id::text,
    jsonb_build_object('line_count', (select count(*) from stock_opname_lines where opname_id = v_opname.id))
  );
  return v_opname;
end;
$$;

create function save_stock_opname_count(p_opname_id uuid, p_counts jsonb)
returns stock_opnames
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opname stock_opnames;
  v_count jsonb;
  v_item_id uuid;
  v_counted_qty numeric(14, 3);
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_opname_id is null or p_counts is null or jsonb_typeof(p_counts) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_opname from stock_opnames where id = p_opname_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OPNAME_NOT_FOUND';
  end if;
  if v_opname.status = 'finalized' then
    raise exception using errcode = 'P0001', message = 'OPNAME_FINALIZED';
  end if;

  for v_count in select value from jsonb_array_elements(p_counts)
  loop
    if jsonb_typeof(v_count) <> 'object'
      or v_count - array['inventory_item_id', 'counted_qty']::text[] <> '{}'::jsonb
      or not (v_count ? 'inventory_item_id') or not (v_count ? 'counted_qty')
      or (v_count->>'counted_qty') !~ '^\d+(\.\d{1,3})?$' then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    v_item_id := (v_count->>'inventory_item_id')::uuid;
    v_counted_qty := (v_count->>'counted_qty')::numeric(14, 3);
    update stock_opname_lines
    set counted_qty = v_counted_qty
    where opname_id = v_opname.id and inventory_item_id = v_item_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'ITEM_NOT_FOUND';
    end if;
  end loop;

  return v_opname;
end;
$$;

create function finalize_stock_opname(p_opname_id uuid)
returns stock_opnames
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opname stock_opnames;
  v_line record;
  v_movement numeric(14, 3);
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_opname_id is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_opname from stock_opnames where id = p_opname_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'OPNAME_NOT_FOUND';
  end if;
  if v_opname.status = 'finalized' then
    raise exception using errcode = 'P0001', message = 'OPNAME_FINALIZED';
  end if;

  for v_line in
    select line.inventory_item_id, line.counted_qty, item.current_qty
    from stock_opname_lines line
    join inventory_items item on item.id = line.inventory_item_id
    where line.opname_id = v_opname.id and line.counted_qty is not null
    order by line.inventory_item_id
    for update of item
  loop
    v_movement := v_line.counted_qty - v_line.current_qty;
    if v_movement <> 0 then
      update inventory_items
      set current_qty = current_qty + v_movement, updated_at = now()
      where id = v_line.inventory_item_id;
      insert into stock_movements (
        inventory_item_id, movement_type, qty_change, reference_type, reference_id, actor_id
      ) values (
        v_line.inventory_item_id,
        'opname',
        v_movement,
        'stock_opname',
        v_opname.id::text,
        auth.uid()
      );
    end if;
  end loop;

  update stock_opnames
  set status = 'finalized', finalized_at = now()
  where id = v_opname.id
  returning * into v_opname;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'opname.finalize',
    'stock_opname',
    v_opname.id::text,
    jsonb_build_object(
      'counted_lines', (select count(*) from stock_opname_lines where opname_id = v_opname.id and counted_qty is not null),
      'status', v_opname.status
    )
  );
  return v_opname;
end;
$$;

revoke all on function open_stock_opname() from public, anon;
revoke all on function save_stock_opname_count(uuid, jsonb) from public, anon;
revoke all on function finalize_stock_opname(uuid) from public, anon;
grant execute on function open_stock_opname() to authenticated;
grant execute on function save_stock_opname_count(uuid, jsonb) to authenticated;
grant execute on function finalize_stock_opname(uuid) to authenticated;
