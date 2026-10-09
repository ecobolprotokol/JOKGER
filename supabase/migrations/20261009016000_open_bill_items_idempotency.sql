create function add_items_to_open_bill(
  p_client_ref uuid,
  p_order_id uuid,
  p_items jsonb
)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request client_requests;
  v_order orders;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_client_ref is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  insert into client_requests (client_ref, rpc_name)
  values (p_client_ref, 'add_items_to_open_bill')
  on conflict (client_ref) do nothing;

  if not found then
    select * into v_request from client_requests where client_ref = p_client_ref;
    if not found or v_request.rpc_name <> 'add_items_to_open_bill' or v_request.result_id is null then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    select * into v_order from orders where id = v_request.result_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
    end if;
    return v_order;
  end if;

  v_order := public.add_items_to_open_bill(p_order_id, p_items);
  update client_requests
  set result_id = v_order.id
  where client_ref = p_client_ref;
  return v_order;
end;
$$;

revoke all on function add_items_to_open_bill(uuid, uuid, jsonb) from public, anon;
grant execute on function add_items_to_open_bill(uuid, uuid, jsonb) to authenticated;