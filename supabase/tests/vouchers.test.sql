begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000001501', 'authenticated', 'authenticated', 'voucher-admin@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000001501', 'voucher-admin@test.local', 'Admin Voucher', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001501', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001501","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select code from public.upsert_voucher(
    '{"code":"hemat10","name":"Hemat Sepuluh","type":"percent","value":10,"min_subtotal":50000,"max_discount":10000,"valid_from":"2026-01-01T00:00:00Z","valid_until":"2027-01-01T00:00:00Z","total_quota":20,"is_active":true}'
  )),
  'HEMAT10',
  'kode voucher dinormalisasi menjadi huruf besar'
);
select is(
  (select name from public.upsert_voucher(
    (select jsonb_build_object(
      'id', id, 'code', code, 'name', 'Hemat Sepuluh Plus', 'type', type,
      'value', value, 'min_subtotal', min_subtotal, 'max_discount', max_discount,
      'valid_from', valid_from, 'valid_until', valid_until, 'total_quota', total_quota,
      'is_active', is_active
    ) from public.vouchers where code = 'HEMAT10')
  )),
  'Hemat Sepuluh Plus',
  'voucher dapat diperbarui'
);
select is(
  (select is_active from public.set_voucher_active(
    (select id from public.vouchers where code = 'HEMAT10'), false
  )),
  false,
  'voucher dapat dinonaktifkan lewat RPC'
);
select throws_ok(
  $$select public.upsert_voucher(
    '{"code":"SALAH","name":"Persen Salah","type":"percent","value":150,"valid_from":"2026-01-01T00:00:00Z","valid_until":"2027-01-01T00:00:00Z"}'
  )$$,
  'P0001',
  'INPUT_INVALID',
  'nilai persentase lebih dari seratus ditolak'
);
set local role postgres;
update public.vouchers set used_count = 1 where code = 'HEMAT10';
set local role authenticated;
select throws_ok(
  $$select public.upsert_voucher(
    (select jsonb_build_object(
      'id', id, 'code', 'KODEBARU', 'name', name, 'type', type,
      'value', value, 'min_subtotal', min_subtotal, 'max_discount', max_discount,
      'valid_from', valid_from, 'valid_until', valid_until, 'total_quota', total_quota,
      'is_active', is_active
    ) from public.vouchers where code = 'HEMAT10')
  )$$,
  'P0001',
  'INPUT_INVALID',
  'kode voucher yang sudah dipakai tidak dapat diganti'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action in ('voucher.create', 'voucher.update', 'voucher.deactivate')),
  'perubahan voucher tercatat di audit'
);

select * from finish();
rollback;