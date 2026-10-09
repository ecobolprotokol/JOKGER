begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000401',
  'authenticated',
  'authenticated',
  'items-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000401',
  'items-admin@test.local',
  'Admin Item',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000000410', 'Item');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000410', 'Menu Item', 10000);
insert into public.inventory_items (id, name, unit, current_qty)
values ('00000000-0000-4000-8000-000000000412', 'Bahan Item', 'g', 5);
insert into public.recipe_lines (menu_item_id, inventory_item_id, qty_per_serving)
values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000412', 1);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000401","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000000499',
  'dine_in',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000411","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  'D1',
  null,
  'open',
  '[]'
);

select is(
  (select subtotal from public.add_items_to_open_bill(
    (select id from public.orders where table_label = 'D1'),
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000411","qty":2,"modifier_option_ids":[],"note":null}]'
  )),
  30000::bigint,
  'penambahan item menghitung ulang subtotal'
);
select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000412'),
  2::numeric,
  'penambahan item mengurangi stok sesuai resep'
);

select is(
  (select subtotal from public.void_order_item(
    (select id from public.order_items where order_id = (select id from public.orders where table_label = 'D1') and qty = 2),
    'Salah pesan'
  )),
  10000::bigint,
  'void mengembalikan total pesanan'
);
select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000412'),
  4::numeric,
  'void mengembalikan stok bahan'
);
select throws_ok(
  $$select public.void_order_item(
    (select id from public.order_items where order_id = (select id from public.orders where table_label = 'D1') and qty = 2),
    'Salah pesan'
  )$$,
  'P0001',
  'ITEM_ALREADY_VOIDED',
  'item yang sudah di-void tidak dapat di-void ulang'
);
select throws_ok(
  $$select public.void_order_item(
    (select id from public.order_items where order_id = (select id from public.orders where table_label = 'D1') order by created_at limit 1),
    '  '
  )$$,
  'P0001',
  'REASON_REQUIRED',
  'alasan void wajib minimal tiga karakter'
);

select * from finish();
rollback;
