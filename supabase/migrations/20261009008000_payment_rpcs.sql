create function submit_payment(
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
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_order_id is null or p_method is null or p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_AMOUNT_INVALID';
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
  return v_payment;
end;
$$;

create function verify_payment(p_payment_id uuid, p_approve boolean, p_note text)
returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
  v_action text;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_payment_id is null or p_approve is null or (p_note is not null and length(p_note) > 200) then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if not p_approve and (p_note is null or length(btrim(p_note)) < 3) then
    raise exception using errcode = 'P0001', message = 'REASON_REQUIRED';
  end if;

  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status <> 'pending_verification' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_PENDING';
  end if;

  update payments
  set status = case when p_approve then 'verified'::payment_status else 'rejected'::payment_status end,
      note = case when p_approve then p_note else btrim(p_note) end,
      verified_by = auth.uid(),
      verified_at = now()
  where id = v_payment.id
  returning * into v_payment;
  v_action := case when p_approve then 'payment.verify' else 'payment.reject' end;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    v_action,
    'payment',
    v_payment.id::text,
    jsonb_build_object('approved', p_approve, 'note', p_note, 'amount', v_payment.amount)
  );
  return v_payment;
end;
$$;

revoke all on function submit_payment(uuid, payment_method, bigint, uuid, text, text, bigint) from public, anon;
revoke all on function verify_payment(uuid, boolean, text) from public, anon;
grant execute on function submit_payment(uuid, payment_method, bigint, uuid, text, text, bigint) to authenticated;
grant execute on function verify_payment(uuid, boolean, text) to authenticated;
