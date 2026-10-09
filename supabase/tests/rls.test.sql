begin;

select plan(7);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000001101', 'authenticated', 'authenticated', 'rls-admin@test.local', '', now()),
  ('00000000-0000-4000-8000-000000001102', 'authenticated', 'authenticated', 'rls-inactive@test.local', '', now());
insert into public.profiles (id, email, full_name, role, is_active)
values
  ('00000000-0000-4000-8000-000000001101', 'rls-admin@test.local', 'Admin RLS', 'admin', true),
  ('00000000-0000-4000-8000-000000001102', 'rls-inactive@test.local', 'Nonaktif RLS', 'admin', false);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001101","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into public.categories (name) values ('RLS ditolak')$$,
  '42501',
  'permission denied for table categories',
  'role authenticated tidak dapat insert tabel operasional'
);
select throws_ok(
  $$update public.menu_items set price = 1$$,
  '42501',
  'permission denied for table menu_items',
  'role authenticated tidak dapat update tabel menu'
);
select throws_ok(
  $$delete from public.payment_accounts$$,
  '42501',
  'permission denied for table payment_accounts',
  'role authenticated tidak dapat menghapus rekening secara langsung'
);
select is(
  (select count(*)::int from public.audit_logs),
  0,
  'admin tidak dapat membaca audit log super admin'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001102', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001102","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.menu_items),
  0,
  'staff nonaktif tidak dapat membaca menu'
);

set local role anon;
select is(
  (select count(*)::int from public.store_settings),
  1,
  'anon dapat membaca satu baris pengaturan publik'
);
select throws_ok(
  $$insert into public.store_settings (id, store_name) values (1, 'Toko')$$,
  '42501',
  'permission denied for table store_settings',
  'anon tidak dapat mengubah pengaturan toko'
);

select * from finish();
rollback;
