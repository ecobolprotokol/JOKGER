begin;

select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000002201', 'authenticated', 'authenticated', 'history-admin@test.local', '', now()),
  ('00000000-0000-4000-8000-000000002202', 'authenticated', 'authenticated', 'history-owner@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values
  ('00000000-0000-4000-8000-000000002201', 'history-admin@test.local', 'Admin History', 'admin'),
  ('00000000-0000-4000-8000-000000002202', 'history-owner@test.local', 'Owner History', 'super_admin');
insert into public.shifts (id, opened_by, opening_cash)
values ('00000000-0000-4000-8000-000000002203', '00000000-0000-4000-8000-000000002201', 0);
insert into public.orders (id, order_no, shift_id, order_type, created_by)
values
  ('00000000-0000-4000-8000-000000002204', 'JKG-HISTORY-0001', '00000000-0000-4000-8000-000000002203', 'takeaway', '00000000-0000-4000-8000-000000002201'),
  ('00000000-0000-4000-8000-000000002205', 'JKG-HISTORY-0002', '00000000-0000-4000-8000-000000002203', 'takeaway', '00000000-0000-4000-8000-000000002201');
insert into public.payments (id, order_id, shift_id, method, amount, status, created_by)
values (
  '00000000-0000-4000-8000-000000002206',
  '00000000-0000-4000-8000-000000002204',
  '00000000-0000-4000-8000-000000002203',
  'cash', 1000, 'verified', '00000000-0000-4000-8000-000000002201'
);
insert into public.audit_logs (actor_id, action, entity, entity_id, payload)
values
  ('00000000-0000-4000-8000-000000002201', 'order.create', 'orders', '00000000-0000-4000-8000-000000002204', '{"status":"new"}'),
  ('00000000-0000-4000-8000-000000002201', 'payment.submit', 'payments', 'payment-1', '{"order_id":"00000000-0000-4000-8000-000000002204"}'),
  ('00000000-0000-4000-8000-000000002201', 'order.status_change', 'order', '00000000-0000-4000-8000-000000002204', '{"to":"processing"}'),
  ('00000000-0000-4000-8000-000000002201', 'payment.submit', 'payment', '00000000-0000-4000-8000-000000002206', '{"amount":1000}'),
  ('00000000-0000-4000-8000-000000002201', 'order.create', 'orders', '00000000-0000-4000-8000-000000002205', '{"status":"new"}');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002201","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.get_order_history('00000000-0000-4000-8000-000000002204')),
  4, 'admin melihat audit pesanan dan pembayaran dalam format plural dan historis'
);
select is(
  (select count(*)::int from public.get_order_history('00000000-0000-4000-8000-000000002204')
   where action = 'order.create'),
  1, 'riwayat pesanan lain tidak ikut'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002202","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.get_order_history('00000000-0000-4000-8000-000000002204')),
  4, 'super admin melihat entri riwayat yang sama'
);
select ok(
  (select array_agg(action order by action) from public.get_order_history('00000000-0000-4000-8000-000000002204'))
    = array['order.create', 'order.status_change', 'payment.submit', 'payment.submit'],
  'riwayat mencakup semua perubahan order dan pembayaran terkait'
);

select * from finish();
rollback;