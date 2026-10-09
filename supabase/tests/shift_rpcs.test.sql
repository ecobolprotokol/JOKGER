begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'shift-admin@test.local',
  '',
  now()
);

insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000001',
  'shift-admin@test.local',
  'Admin Uji',
  'admin'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select opening_cash from public.open_shift(50000)),
  50000::bigint,
  'shift dibuka dengan saldo awal yang diminta'
);

set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'shift.open'),
  'pembukaan shift tercatat di audit'
);

set local role authenticated;
select throws_ok(
  $$select public.open_shift(10000)$$,
  'P0001',
  'SHIFT_ALREADY_OPEN',
  'shift kedua ditolak'
);

select is(
  (select expected_cash from public.close_shift(50000, null)),
  50000::bigint,
  'kas yang diharapkan mencakup saldo awal'
);

set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'shift.close'),
  'penutupan shift tercatat di audit'
);

set local role authenticated;
select throws_ok(
  $$select public.close_shift(50000, null)$$,
  'P0001',
  'SHIFT_NOT_OPEN',
  'shift tertutup tidak dapat ditutup ulang'
);

select * from finish();
rollback;
