create function upsert_voucher(p_voucher jsonb)
returns vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_type voucher_type;
  v_value bigint;
  v_min_subtotal bigint;
  v_max_discount bigint;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
  v_total_quota integer;
  v_is_active boolean;
  v_existing vouchers;
  v_voucher vouchers;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_voucher is null or jsonb_typeof(p_voucher) <> 'object'
    or p_voucher - array[
      'id', 'code', 'name', 'type', 'value', 'min_subtotal', 'max_discount',
      'valid_from', 'valid_until', 'total_quota', 'is_active'
    ]::text[] <> '{}'::jsonb
    or not (p_voucher ? 'code') or not (p_voucher ? 'name') or not (p_voucher ? 'type')
    or not (p_voucher ? 'value') or not (p_voucher ? 'valid_from')
    or not (p_voucher ? 'valid_until') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if jsonb_typeof(p_voucher->'code') <> 'string'
    or jsonb_typeof(p_voucher->'name') <> 'string'
    or p_voucher->>'type' not in ('percent', 'nominal')
    or (p_voucher->>'value') !~ '^\d{1,9}$'
    or (p_voucher ? 'min_subtotal' and jsonb_typeof(p_voucher->'min_subtotal') not in ('number', 'null'))
    or (p_voucher ? 'max_discount' and jsonb_typeof(p_voucher->'max_discount') not in ('number', 'null'))
    or jsonb_typeof(p_voucher->'valid_from') <> 'string'
    or jsonb_typeof(p_voucher->'valid_until') <> 'string'
    or (p_voucher ? 'total_quota' and jsonb_typeof(p_voucher->'total_quota') not in ('number', 'null'))
    or (p_voucher ? 'is_active' and jsonb_typeof(p_voucher->'is_active') <> 'boolean')
    or (p_voucher ? 'id' and (p_voucher->>'id') !~ '^[0-9a-fA-F-]{36}$') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  v_code := upper(btrim(p_voucher->>'code'));
  v_name := nullif(btrim(p_voucher->>'name'), '');
  v_type := (p_voucher->>'type')::voucher_type;
  v_value := (p_voucher->>'value')::bigint;
  v_min_subtotal := coalesce(nullif(p_voucher->>'min_subtotal', '')::bigint, 0);
  v_max_discount := nullif(p_voucher->>'max_discount', '')::bigint;
  v_valid_from := (p_voucher->>'valid_from')::timestamptz;
  v_valid_until := (p_voucher->>'valid_until')::timestamptz;
  v_total_quota := nullif(p_voucher->>'total_quota', '')::integer;
  v_is_active := coalesce((p_voucher->>'is_active')::boolean, true);

  if v_code !~ '^[A-Z0-9-]{3,32}$' or v_name is null or length(v_name) > 100
    or v_value <= 0 or v_min_subtotal < 0
    or (v_type = 'percent' and v_value > 100)
    or (v_max_discount is not null and v_max_discount <= 0)
    or (v_type = 'nominal' and v_max_discount is not null)
    or v_valid_until <= v_valid_from
    or (v_total_quota is not null and v_total_quota <= 0) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if p_voucher ? 'id' then
    v_id := (p_voucher->>'id')::uuid;
    select * into v_existing from vouchers where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_FOUND';
    end if;
    if v_existing.used_count > 0 and v_existing.code <> v_code then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    if v_total_quota is not null and v_total_quota < v_existing.used_count then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    update vouchers
    set code = v_code,
        name = v_name,
        type = v_type,
        value = v_value,
        min_subtotal = v_min_subtotal,
        max_discount = v_max_discount,
        valid_from = v_valid_from,
        valid_until = v_valid_until,
        total_quota = v_total_quota,
        is_active = v_is_active
    where id = v_id
    returning * into v_voucher;
  else
    insert into vouchers (
      code, name, type, value, min_subtotal, max_discount,
      valid_from, valid_until, total_quota, is_active, created_by
    ) values (
      v_code, v_name, v_type, v_value, v_min_subtotal, v_max_discount,
      v_valid_from, v_valid_until, v_total_quota, v_is_active, auth.uid()
    ) returning * into v_voucher;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    case when v_existing.id is null then 'voucher.create' else 'voucher.update' end,
    'voucher',
    v_voucher.id::text,
    jsonb_build_object('code', v_voucher.code, 'type', v_voucher.type, 'value', v_voucher.value)
  );
  return v_voucher;
end;
$$;

create function set_voucher_active(p_voucher_id uuid, p_active boolean)
returns vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher vouchers;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_voucher_id is null or p_active is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  select * into v_voucher from vouchers where id = p_voucher_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'VOUCHER_NOT_FOUND';
  end if;

  update vouchers set is_active = p_active where id = v_voucher.id returning * into v_voucher;
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    case when p_active then 'voucher.activate' else 'voucher.deactivate' end,
    'voucher',
    v_voucher.id::text,
    jsonb_build_object('code', v_voucher.code, 'is_active', p_active)
  );
  return v_voucher;
end;
$$;

revoke all on function upsert_voucher(jsonb) from public, anon;
revoke all on function set_voucher_active(uuid, boolean) from public, anon;
grant execute on function upsert_voucher(jsonb) to authenticated;
grant execute on function set_voucher_active(uuid, boolean) to authenticated;