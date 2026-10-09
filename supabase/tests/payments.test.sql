begin;

select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000001001',
  'authenticated',
  'authenticated',
  'payment-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000001001',
  'payment-admin@test.local',
  'Admin Payment',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000001010', 'Payment');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001010', 'Menu Payment', 10000);
insert into public.payment_accounts (id, method, provider, account_name, account_no)
values ('00000000-0000-4000-8000-000000001012', 'transfer', 'Bank Uji', 'JOKGER', '1234567890');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001001","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000001099',
  'takeaway',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000001011","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  null,
  null,
  'none',
  '[]'
);
select public.create_order(
  '00000000-0000-4000-8000-000000001098',
  'takeaway',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000001011","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  null,
  null,
  'none',
  '[]'
);

select is(
  (select status::text from public.submit_payment(
    '00000000-0000-4000-8000-000000001020',
    (select id from public.orders where order_no like '%0001'),
    'transfer',
    10000,
    '00000000-0000-4000-8000-000000001012',
    'REF12345',
    null,
    null
  )),
  'pending_verification',
  'transfer dibuat menunggu verifikasi'
);
select is(
  (select id::text from public.submit_payment(
    '00000000-0000-4000-8000-000000001020',
    (select id from public.orders where order_no like '%0001'),
    'transfer',
    10000,
    '00000000-0000-4000-8000-000000001012',
    'REF12345',
    null,
    null
  )),
  (select id::text from public.payments where order_id = (select id from public.orders where order_no like '%0001')),
  'retry dengan client_ref sama mengembalikan pembayaran yang sama'
);
select is(
  (select count(*)::int from public.payments where order_id = (select id from public.orders where order_no like '%0001')),
  1,
  'retry pembayaran tidak membuat baris pembayaran kedua'
);

select throws_ok(
  $$select public.verify_payment(
    (select id from public.payments where order_id = (select id from public.orders where order_no like '%0001')),
    false,
    null
  )$$,
  'P0001',
  'REASON_REQUIRED',
  'penolakan tanpa alasan ditolak'
);
select is(
  (select status::text from public.verify_payment(
    (select id from public.payments where order_id = (select id from public.orders where order_no like '%0001')),
    true,
    null
  )),
  'verified',
  'pembayaran pending dapat disetujui'
);
select throws_ok(
  $$select public.verify_payment(
    (select id from public.payments where order_id = (select id from public.orders where order_no like '%0001')),
    true,
    null
  )$$,
  'P0001',
  'PAYMENT_NOT_PENDING',
  'pembayaran tidak dapat diverifikasi dua kali'
);

select public.submit_payment(
  '00000000-0000-4000-8000-000000001021',
  (select id from public.orders where order_no like '%0002'),
  'transfer',
  10000,
  '00000000-0000-4000-8000-000000001012',
  'REF67890',
  null,
  null
);
select is(
  (select status::text from public.verify_payment(
    (select id from public.payments where order_id = (select id from public.orders where order_no like '%0002')),
    false,
    'Bukti tidak sesuai'
  )),
  'rejected',
  'pembayaran dapat ditolak dengan alasan'
);

set local role postgres;
select is(
  (select count(*)::int from public.audit_logs where action in ('payment.verify', 'payment.reject')),
  2,
  'aksi verifikasi dan penolakan tercatat di audit'
);
select * from finish();
rollback;
