begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000002001', 'authenticated', 'authenticated', 'staff-owner@test.local', '', now()),
  ('00000000-0000-4000-8000-000000002002', 'authenticated', 'authenticated', 'staff-admin@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values
  ('00000000-0000-4000-8000-000000002001', 'staff-owner@test.local', 'Owner Staff', 'super_admin'),
  ('00000000-0000-4000-8000-000000002002', 'staff-admin@test.local', 'Admin Staff', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_staff_role('00000000-0000-4000-8000-000000002002', 'super_admin')$$,
  'P0001', 'NOT_AUTHORIZED', 'admin tidak dapat mengubah peran staff'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_staff_role('00000000-0000-4000-8000-000000002001', 'admin')$$,
  'P0001', 'SELF_ROLE_CHANGE_FORBIDDEN', 'super admin tidak dapat mengubah peran sendiri'
);
select throws_ok(
  $$select public.set_staff_active('00000000-0000-4000-8000-000000002001', false)$$,
  'P0001', 'SELF_DEACTIVATION_FORBIDDEN', 'super admin tidak dapat menonaktifkan diri sendiri'
);
select throws_ok(
  $$select public.set_staff_role('00000000-0000-4000-8000-000000002099', 'admin')$$,
  'P0001', 'STAFF_NOT_FOUND', 'staff yang tidak ditemukan ditolak'
);
select is(
  (select role::text from public.set_staff_role('00000000-0000-4000-8000-000000002002', 'super_admin')),
  'super_admin', 'peran staff dapat dinaikkan'
);
select is(
  (select role::text from public.set_staff_role('00000000-0000-4000-8000-000000002002', 'admin')),
  'admin', 'super admin lain dapat diturunkan'
);
select is(
  (select is_active from public.set_staff_active('00000000-0000-4000-8000-000000002002', false)),
  false, 'staff dapat dinonaktifkan'
);
select throws_ok(
  $$select public.set_staff_role('00000000-0000-4000-8000-000000002001', 'admin')$$,
  'P0001', 'LAST_SUPER_ADMIN', 'super admin aktif terakhir tidak dapat diturunkan'
);
select throws_ok(
  $$select public.set_staff_active('00000000-0000-4000-8000-000000002001', false)$$,
  'P0001', 'LAST_SUPER_ADMIN', 'super admin aktif terakhir tidak dapat dinonaktifkan'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'staff.role_update')
    and exists (select 1 from public.audit_logs where action = 'staff.deactivate'),
  'perubahan peran dan aktivasi tercatat di audit'
);

select * from finish();
rollback;