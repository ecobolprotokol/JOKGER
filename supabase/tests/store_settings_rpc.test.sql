begin;

select plan(5);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000001901', 'authenticated', 'authenticated', 'settings-admin@test.local', '', now()),
  ('00000000-0000-4000-8000-000000001902', 'authenticated', 'authenticated', 'settings-owner@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values
  ('00000000-0000-4000-8000-000000001901', 'settings-admin@test.local', 'Admin Settings', 'admin'),
  ('00000000-0000-4000-8000-000000001902', 'settings-owner@test.local', 'Owner Settings', 'super_admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001901","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.update_store_settings('{"store_name":"Ditolak"}')$$,
  'P0001', 'NOT_AUTHORIZED', 'admin tidak dapat mengubah pengaturan toko'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001902', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001902","role":"authenticated"}', true);
select is(
  (select store_name from public.update_store_settings('{"store_name":"Kedai Uji"}')),
  'Kedai Uji',
  'super admin dapat memperbarui pengaturan'
);
select throws_ok(
  $$select public.update_store_settings('{"primary_color":"#777777","accent_color":"#777777"}')$$,
  'P0001', 'CONTRAST_TOO_LOW', 'warna dengan kontras rendah ditolak'
);
select throws_ok(
  $$select public.update_store_settings('{"font_family":"Comic Sans"}')$$,
  'P0001', 'INPUT_INVALID', 'font di luar daftar ditolak'
);
select throws_ok(
  $$select public.update_store_settings('{"unknown_setting":true}')$$,
  'P0001', 'INPUT_INVALID', 'field yang tidak dikenal ditolak'
);

select * from finish();
rollback;