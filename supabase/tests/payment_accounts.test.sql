begin;

select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000901', 'authenticated', 'authenticated', 'account-admin@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000000901', 'account-admin@test.local', 'Admin Rekening', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select provider from public.upsert_payment_account(
    '{"method":"transfer","provider":"Bank Uji","account_name":"JOKGER","account_no":"1234567890","sort_order":1,"is_active":true}'
  )),
  'Bank Uji',
  'rekening baru dibuat lewat RPC'
);
select is(
  (select is_active from public.set_payment_account_active(
    (select id from public.payment_accounts where provider = 'Bank Uji'), false
  )),
  false,
  'rekening dapat dinonaktifkan tanpa dihapus'
);
select throws_ok(
  $$select public.upsert_payment_account('{"method":"transfer","provider":"Bank","account_name":"Toko","account_no":"12"}')$$,
  'P0001',
  'INPUT_INVALID',
  'nomor rekening kurang dari lima digit ditolak'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'payment_account.update'),
  'perubahan rekening tercatat di audit'
);

select * from finish();
rollback;
