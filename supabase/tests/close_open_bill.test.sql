begin;

select plan(7);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000301',
  'authenticated',
  'authenticated',
  'bill-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000301',
  'bill-admin@test.local',
  'Admin Bill',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000000310', 'Bill');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000310', 'Menu Bill', 10000);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000000399',
  'dine_in',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000311","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  'B1',
  null,
  'open',
  '[]'
);

select is(
  (select bill_state::text from public.orders where table_label = 'B1'),
  'open',
  'create_order membuat bill terbuka'
);

select is(
  (select bill_state::text from public.close_open_bill(
    '00000000-0000-4000-8000-000000000398',
    (select id from public.orders where table_label = 'B1'),
    '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]',
    null
  )),
  'closed',
  'close_open_bill menutup bill setelah pembayaran tepat'
);

select is(
  (select id::text from public.close_open_bill(
    '00000000-0000-4000-8000-000000000398',
    (select id from public.orders where table_label = 'B1'),
    '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]',
    null
  )),
  (select id::text from public.orders where table_label = 'B1'),
  'retry dengan client_ref yang sama mengembalikan bill yang sama'
);
select is((select count(*)::int from public.payments), 1, 'retry tidak membuat pembayaran kedua');

select public.create_order(
  '00000000-0000-4000-8000-000000000395',
  'dine_in',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000311","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  'B2',
  null,
  'open',
  '[]'
);

select throws_ok(
  $$select public.close_open_bill(
    '00000000-0000-4000-8000-000000000397',
    (select id from public.orders where table_label = 'B1'),
    '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]',
    null
  )$$,
  'P0001',
  'BILL_CLOSED',
  'bill tertutup tidak dapat ditutup lagi memakai client_ref baru'
);

select throws_ok(
  $$select public.close_open_bill(
    '00000000-0000-4000-8000-000000000396',
    (select id from public.orders where table_label = 'B2'),
    '[{"method":"cash","amount":5000,"received_amount":5000,"payment_account_id":null,"reference_no":null,"proof_path":null}]',
    null
  )$$,
  'P0001',
  'CASH_RECEIVED_INSUFFICIENT',
  'pembayaran kurang tidak menutup bill'
);

select is((select count(*)::int from public.payments), 1, 'payment yang ditolak tidak tersimpan');

select * from finish();
rollback;
