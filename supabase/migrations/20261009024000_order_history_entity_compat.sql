create or replace function get_order_history(p_order_id uuid)
returns table (
  id uuid,
  action text,
  actor_name text,
  created_at timestamptz,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if not exists (select 1 from orders where orders.id = p_order_id) then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;

  return query
  select md5(log.id::text)::uuid, log.action, coalesce(profile.full_name, 'Sistem'), log.created_at, log.payload
  from audit_logs log
  left join profiles profile on profile.id = log.actor_id
  where (
      log.entity in ('orders', 'order')
      and log.entity_id = p_order_id::text
    )
    or (
      log.entity = 'payments'
      and log.payload->>'order_id' = p_order_id::text
    )
    or (
      log.entity = 'payment'
      and exists (
        select 1 from payments payment
        where payment.id::text = log.entity_id and payment.order_id = p_order_id
      )
    )
  order by log.created_at desc, log.id desc;
end;
$$;

revoke all on function get_order_history(uuid) from public, anon;
grant execute on function get_order_history(uuid) to authenticated;