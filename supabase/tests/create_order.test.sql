begin;

select plan(7);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000101',
  'authenticated',
  'authenticated',
  'order-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000101',
  'order-admin@test.local',
  'Admin Uji',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000000110', 'Uji');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000110', 'Menu Uji', 10000);
insert into public.inventory_items (id, name, unit, current_qty)
values ('00000000-0000-4000-8000-000000000112', 'Bahan Uji', 'g', 5);
insert into public.recipe_lines (menu_item_id, inventory_item_id, qty_per_serving)
values ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000112', 1);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);

select is(
  (select grand_total from public.create_order(
    '00000000-0000-4000-8000-000000000199',
    'takeaway',
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000111","qty":2,"modifier_option_ids":[],"note":null}]',
    null,
    null,
    null,
    'none',
    '[{"method":"cash","amount":20000,"received_amount":25000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
  )),
  20000::bigint,
  'create_order menyimpan total dan menerima pembayaran tunai'
);

select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000112'),
  3::numeric,
  'stok berkurang secara atomik sesuai resep'
);

select is(
  (select id::text from public.create_order(
    '00000000-0000-4000-8000-000000000199',
    'takeaway',
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000111","qty":1,"modifier_option_ids":[],"note":null}]',
    null,
    null,
    null,
    'none',
    '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
  )),
  (select id::text from public.orders limit 1),
  'client_ref yang sama mengembalikan pesanan yang sama'
);

select is((select count(*)::int from public.orders), 1, 'retry tidak membuat pesanan kedua');
select is((select count(*)::int from public.payments), 1, 'retry tidak membuat pembayaran kedua');

select throws_ok(
  $$select public.create_order(
    '00000000-0000-4000-8000-000000000198',
    'takeaway',
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000111","qty":1,"modifier_option_ids":[],"note":null}]',
    null,
    null,
    null,
    'none',
    '[{"method":"cash","amount":5000,"received_amount":5000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
  )$$,
  'P0001',
  'CASH_RECEIVED_INSUFFICIENT',
  'total pembayaran yang berbeda dari total server ditolak'
);

select is((select count(*)::int from public.orders), 1, 'checkout yang ditolak tidak meninggalkan order');
select * from finish();
rollback;
