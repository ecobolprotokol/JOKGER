create function set_staff_role(p_user_id uuid, p_role role_type)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_previous_role role_type;
  v_super_admin_count bigint;
begin
  if not is_super_admin() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_user_id is null or p_role is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_user_id = auth.uid() then
    raise exception using errcode = 'P0001', message = 'SELF_ROLE_CHANGE_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext('jokger.super_admin_count'));
  select * into v_profile from profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'STAFF_NOT_FOUND';
  end if;
  v_previous_role := v_profile.role;
  if v_profile.is_active and v_previous_role = 'super_admin' and p_role <> 'super_admin' then
    select count(*) into v_super_admin_count from profiles where is_active and role = 'super_admin';
    if v_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN';
    end if;
  end if;

  update profiles set role = p_role, updated_at = now()
  where id = p_user_id returning * into v_profile;
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), 'staff.role_update', 'profile', p_user_id::text,
    jsonb_build_object('old_role', v_previous_role, 'new_role', p_role)
  );
  return v_profile;
end;
$$;

create function set_staff_active(p_user_id uuid, p_active boolean)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_super_admin_count bigint;
begin
  if not is_super_admin() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_user_id is null or p_active is null then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;
  if p_user_id = auth.uid() and not p_active then
    raise exception using errcode = 'P0001', message = 'SELF_DEACTIVATION_FORBIDDEN';
  end if;

  perform pg_advisory_xact_lock(hashtext('jokger.super_admin_count'));
  select * into v_profile from profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'STAFF_NOT_FOUND';
  end if;
  if v_profile.is_active and v_profile.role = 'super_admin' and not p_active then
    select count(*) into v_super_admin_count from profiles where is_active and role = 'super_admin';
    if v_super_admin_count <= 1 then
      raise exception using errcode = 'P0001', message = 'LAST_SUPER_ADMIN';
    end if;
  end if;

  update profiles set is_active = p_active, updated_at = now()
  where id = p_user_id returning * into v_profile;
  insert into audit_logs (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(), case when p_active then 'staff.activate' else 'staff.deactivate' end,
    'profile', p_user_id::text, jsonb_build_object('is_active', p_active)
  );
  return v_profile;
end;
$$;

revoke all on function set_staff_role(uuid, role_type) from public, anon;
revoke all on function set_staff_active(uuid, boolean) from public, anon;
grant execute on function set_staff_role(uuid, role_type) to authenticated;
grant execute on function set_staff_active(uuid, boolean) to authenticated;