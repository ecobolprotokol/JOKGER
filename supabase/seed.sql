do $$
declare
  v_admin_id constant uuid := '00000000-0000-4000-8000-000000000201';
  v_owner_id constant uuid := '00000000-0000-4000-8000-000000000202';
  v_admin_email constant text := 'admin@jokger.local';
  v_owner_email constant text := 'owner@jokger.local';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) values
    (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      extensions.crypt('AdminLocal#2026', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Admin Lokal'),
      now(),
      now(),
      false,
      false
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_owner_id,
      'authenticated',
      'authenticated',
      v_owner_email,
      extensions.crypt('OwnerLocal#2026', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Super Admin Lokal'),
      now(),
      now(),
      false,
      false
    )
  on conflict (id) do update
  set email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      raw_app_meta_data = excluded.raw_app_meta_data,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values
    (
      v_admin_id::text,
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email),
      'email',
      now(),
      now(),
      now()
    ),
    (
      v_owner_id::text,
      v_owner_id,
      jsonb_build_object('sub', v_owner_id::text, 'email', v_owner_email),
      'email',
      now(),
      now(),
      now()
    )
  on conflict (provider_id, provider) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();

  insert into public.profiles (id, email, full_name, role, is_active)
  values
    (v_admin_id, v_admin_email, 'Admin Lokal', 'admin', true),
    (v_owner_id, v_owner_email, 'Super Admin Lokal', 'super_admin', true)
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      is_active = true,
      updated_at = now();
end;
$$;