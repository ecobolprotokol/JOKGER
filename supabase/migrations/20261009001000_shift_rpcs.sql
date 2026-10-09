create function open_shift(p_opening_cash bigint)
returns shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;

  if p_opening_cash is null or p_opening_cash < 0 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext('jokger.open_shift'));
  if exists (select 1 from shifts where status = 'open') then
    raise exception using errcode = 'P0001', message = 'SHIFT_ALREADY_OPEN';
  end if;

  insert into shifts (opened_by, opening_cash)
  values (auth.uid(), p_opening_cash)
  returning * into v_shift;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'shift.open',
    'shift',
    v_shift.id::text,
    jsonb_build_object('opening_cash', p_opening_cash)
  );

  return v_shift;
end;
$$;

create function close_shift(p_actual_cash bigint, p_note text)
returns shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift shifts;
  v_expected_cash bigint;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;

  if p_actual_cash is null or p_actual_cash < 0 or length(p_note) > 200 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_shift
  from shifts
  where status = 'open'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SHIFT_NOT_OPEN';
  end if;

  if exists (
    select 1
    from orders
    where shift_id = v_shift.id and bill_state = 'open'
  ) then
    raise exception using errcode = 'P0001', message = 'SHIFT_HAS_OPEN_BILL';
  end if;

  select v_shift.opening_cash + coalesce(sum(amount), 0)
  into v_expected_cash
  from payments
  where shift_id = v_shift.id
    and method = 'cash'
    and status = 'verified';

  update shifts
  set status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      expected_cash = v_expected_cash,
      actual_cash = p_actual_cash,
      difference = p_actual_cash - v_expected_cash,
      note = p_note
  where id = v_shift.id
  returning * into v_shift;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'shift.close',
    'shift',
    v_shift.id::text,
    jsonb_build_object(
      'expected_cash', v_shift.expected_cash,
      'actual_cash', v_shift.actual_cash,
      'difference', v_shift.difference,
      'note', p_note
    )
  );

  return v_shift;
end;
$$;

revoke all on function open_shift(bigint) from public, anon;
revoke all on function close_shift(bigint, text) from public, anon;
grant execute on function open_shift(bigint) to authenticated;
grant execute on function close_shift(bigint, text) to authenticated;
