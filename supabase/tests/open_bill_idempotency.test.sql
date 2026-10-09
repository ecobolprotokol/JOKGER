begin;

select plan(5);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000481',
  'authenticated',
  'authenticated',
  'open-bill-retry@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000481',
  'open-bill-retry@test.local',
  'Admin Retry Bill',
  'admin'
);
insert into public.categories (id, name)
values ('00000000-0000-4000-8000-000000000482', 'Retry Bill');
insert into public.menu_items (id, category_id, name, price)
values (
  '00000000-0000-4000-8000-000000000483',
  '00000000-0000-4000-8000-000000000482',
  'Menu Retry',
  10000
);
insert into public.inventory_items (id, name, unit, current_qty)
values ('00000000-0000-4000-8000-000000000484', 'Bahan Retry', 'g', 5);
insert into public.recipe_lines (menu_item_id, inventory_item_id, qty_per_serving)
values (
  '00000000-0000-4000-8000-000000000483',
  '00000000-0000-4000-8000-000000000484',
  1
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000481', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000481","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000000485',
  'dine_in',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000483","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  'R1',
  null,
  'open',
  '[]'
);

select is(
  (select subtotal from public.add_items_to_open_bill(
    '00000000-0000-4000-8000-000000000486',
    (select id from public.orders where table_label = 'R1'),
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000483","qty":2,"modifier_option_ids":[],"note":null}]'
  )),
  30000::bigint,
  'penambahan item pertama mengubah subtotal bill'
);
select is(
  (select id::text from public.add_items_to_open_bill(
    '00000000-0000-4000-8000-000000000486',
    (select id from public.orders where table_label = 'R1'),
    '[{"menu_item_id":"00000000-0000-4000-8000-000000000483","qty":2,"modifier_option_ids":[],"note":null}]'
  )),
  (select id::text from public.orders where table_label = 'R1'),
  'retry mengembalikan bill yang sama'
);
select is(
  (select count(*)::int from public.order_items
   where order_id = (select id from public.orders where table_label = 'R1')),
  2,
  'retry tidak membuat baris item atau movement stok ganda'
);
select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000484'),
  2::numeric,
  'stok hanya dikurangi sekali untuk retry dengan ref sama'
);
select throws_ok(
  $$select public.add_items_to_open_bill(
    '00000000-0000-4000-8000-000000000486',
    (select id from public.orders where table_label = 'R1'),
    '[]'
  )$$,
  'P0001',
  'INPUT_INVALID',
  'ref yang sudah dipakai RPC lain tidak dapat digunakan ulang'
);

select * from finish();
rollback;