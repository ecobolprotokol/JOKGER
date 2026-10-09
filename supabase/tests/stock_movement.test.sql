begin;

select plan(5);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000601', 'authenticated', 'authenticated', 'stock-admin@test.local', '', now()),
  ('00000000-0000-4000-8000-000000000602', 'authenticated', 'authenticated', 'stock-super@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values
  ('00000000-0000-4000-8000-000000000601', 'stock-admin@test.local', 'Admin Stok', 'admin'),
  ('00000000-0000-4000-8000-000000000602', 'stock-super@test.local', 'Super Stok', 'super_admin');
insert into public.inventory_items (id, name, unit, current_qty)
values ('00000000-0000-4000-8000-000000000611', 'Bahan Stok', 'g', 0);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000601', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select qty_change from public.record_stock_movement(
    '00000000-0000-4000-8000-000000000611', 'purchase', 5, null, false
  )),
  5::numeric,
  'pembelian menambah stok'
);
select is(
  (select qty_change from public.record_stock_movement(
    '00000000-0000-4000-8000-000000000611', 'waste', 2, 'Bahan rusak', false
  )),
  -2::numeric,
  'waste mengurangi stok dan mewajibkan alasan'
);
select throws_ok(
  $$select public.record_stock_movement('00000000-0000-4000-8000-000000000611', 'adjustment', -10, 'Koreksi stok', false)$$,
  'P0001',
  'STOCK_INSUFFICIENT',
  'stok negatif ditolak untuk admin'
);

set local role postgres;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000602', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000602","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select qty_change from public.record_stock_movement(
    '00000000-0000-4000-8000-000000000611', 'adjustment', -10, 'Koreksi inventaris', true
  )),
  -10::numeric,
  'super admin dapat mengizinkan stok negatif dengan alasan'
);
select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000611'),
  -7::numeric,
  'cache stok mengikuti seluruh movement'
);

select * from finish();
rollback;
