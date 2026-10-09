create function upsert_payment_account(p_account jsonb)
returns payment_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_method payment_method;
  v_provider text;
  v_account_name text;
  v_account_no text;
  v_sort_order int;
  v_is_active boolean;
  v_account payment_accounts;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_account is null or jsonb_typeof(p_account) <> 'object'
    or p_account - array['id', 'method', 'provider', 'account_name', 'account_no', 'sort_order', 'is_active']::text[] <> '{}'::jsonb
    or not (p_account ? 'method') or not (p_account ? 'provider')
    or not (p_account ? 'account_name') or not (p_account ? 'account_no') then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  if p_account->>'method' not in ('transfer', 'ewallet')
    or length(btrim(p_account->>'provider')) not between 1 and 60
    or length(btrim(p_account->>'account_name')) not between 1 and 100
    or (p_account->>'account_no') !~ '^[0-9]{5,30}$' then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  v_method := (p_account->>'method')::payment_method;
  v_provider := btrim(p_account->>'provider');
  v_account_name := btrim(p_account->>'account_name');
  v_account_no := p_account->>'account_no';
  v_sort_order := coalesce(nullif(p_account->>'sort_order', '')::int, 0);
  v_is_active := coalesce(nullif(p_account->>'is_active', '')::boolean, true);

  if p_account ? 'id' and nullif(p_account->>'id', '') is not null then
    v_id := (p_account->>'id')::uuid;
    perform 1 from payment_accounts where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
    end if;
    update payment_accounts
    set method = v_method,
        provider = v_provider,
        account_name = v_account_name,
        account_no = v_account_no,
        sort_order = v_sort_order,
        is_active = v_is_active,
        updated_at = now()
    where id = v_id
    returning * into v_account;
  else
    insert into payment_accounts (method, provider, account_name, account_no, sort_order, is_active)
    values (v_method, v_provider, v_account_name, v_account_no, v_sort_order, v_is_active)
    returning * into v_account;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'payment_account.update',
    'payment_account',
    v_account.id::text,
    jsonb_build_object('method', v_method, 'provider', v_provider, 'is_active', v_is_active)
  );
  return v_account;
end;
$$;

create function set_payment_account_active(p_account_id uuid, p_active boolean)
returns payment_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account payment_accounts;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_account_id is null or p_active is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  select * into v_account from payment_accounts where id = p_account_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ACCOUNT_INVALID';
  end if;

  update payment_accounts
  set is_active = p_active, updated_at = now()
  where id = v_account.id
  returning * into v_account;

  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    'payment_account.update',
    'payment_account',
    v_account.id::text,
    jsonb_build_object('is_active', p_active)
  );
  return v_account;
end;
$$;

revoke all on function upsert_payment_account(jsonb) from public, anon;
revoke all on function set_payment_account_active(uuid, boolean) from public, anon;
grant execute on function upsert_payment_account(jsonb) to authenticated;
grant execute on function set_payment_account_active(uuid, boolean) to authenticated;
