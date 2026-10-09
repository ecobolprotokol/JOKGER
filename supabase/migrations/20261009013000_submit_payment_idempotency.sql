drop function public.submit_payment(uuid, payment_method, bigint, uuid, text, text, bigint);

create function submit_payment(
  p_client_ref uuid,
  p_order_id uuid,
  p_method payment_method,
  p_amount bigint,
  p_payment_account_id uuid,
  p_reference_no text,
  p_proof_path text,
  p_received_amount bigint
)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
  v_shift shifts;
  v_outstanding bigint;
  v_status payment_status;
  v_change bigint := 0;
  v_payment payments;
  v_reference text;
  v_request client_requests;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_client_ref is null or p_order_id is null or p_method is null
    or p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_AMOUNT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_ref::text, 0));
  insert into client_requests (client_ref, rpc_name)
  values (p_client_ref, 'submit_payment')
  on conflict (client_ref) do nothing;
  if not found then
    select * into v_request from client_requests where client_ref = p_client_ref;
    if not found or v_request.rpc_name <> 'submit_payment' or v_request.result_id is null then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    select * into v_payment from payments where id = v_request.result_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
    end if;
    return v_payment;
  end if;

  if p_reference_no is not null and length(p_reference_no) > 40 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_proof_path is not null and (length(p_proof_path) > 500 or p_proof_path like 'http%') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;
  if v_order.bill_state = 'open' then
    raise exception using errcode = 'P0001', message = 'BILL_NOT_CLOSED';
  end if;

  select * into v_shift from shifts where id = v_order.shift_id for update;
  if not found or v_shift.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'SHIFT_NOT_OPEN';
  end if;

  select v_order.grand_total - coalesce(sum(amount), 0)
  into v_outstanding
  from payments
  where order_id = v_order.id
    and not is_refund
    and status in ('verified', 'pending_verification');
  if p_amount > v_outstanding then
    raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_OUTSTANDING';
  end if;

  if p_method = 'cash' then
    if p_payment_account_id is not null then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
    end if;
    if p_received_amount is null or p_received_amount < p_amount then
      raise exception using errcode = 'P0001', message = 'CASH_RECEIVED_INSUFFICIENT';
    end if;
    v_status := 'verified';
    v_change := p_received_amount - p_amount;
    v_reference := null;
  else
    if p_payment_account_id is null or p_reference_no is null
      or btrim(p_reference_no) !~ '^[A-Za-z0-9]{4,40}$'
      or not exists (
        select 1 from payment_accounts
        where id = p_payment_account_id and is_active and method = p_method
      ) then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
    end if;
    v_status := 'pending_verification';
    v_reference := btrim(p_reference_no);
  end if;

  insert into payments (
    order_id, shift_id, method, payment_account_id, amount, received_amount,
    change_amount, status, reference_no, proof_path, created_by,
    verified_by, verified_at
  ) values (
    v_order.id,
    v_shift.id,
    p_method,
    p_payment_account_id,
    p_amount,
    p_received_amount,
    v_change,
    v_status,
    v_reference,
    p_proof_path,
    auth.uid(),
    case when v_status = 'verified' then auth.uid() else null end,
    case when v_status = 'verified' then now() else null end
  ) returning * into v_payment;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'payment.submit',
    'payment',
    v_payment.id::text,
    jsonb_build_object('order_no', v_order.order_no, 'method', p_method, 'amount', p_amount, 'status', v_status)
  );
  update client_requests
  set result_id = v_payment.id
  where client_ref = p_client_ref;
  return v_payment;
end;
$$;

revoke all on function submit_payment(uuid, uuid, payment_method, bigint, uuid, text, text, bigint) from public, anon;
grant execute on function submit_payment(uuid, uuid, payment_method, bigint, uuid, text, text, bigint) to authenticated;