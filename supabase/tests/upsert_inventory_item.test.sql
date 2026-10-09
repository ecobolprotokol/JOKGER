begin;

select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000000801', 'authenticated', 'authenticated', 'upsert-stock@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000000801', 'upsert-stock@test.local', 'Admin Bahan', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select current_qty from public.upsert_inventory_item(
    '{"name":"Gula","unit":"g","min_qty":2.5,"unit_cost":15000,"is_active":true}'
  )),
  0::numeric,
  'bahan baru dibuat tanpa mengubah stok awal'
);
select public.record_stock_movement(
  (select id from public.inventory_items where name = 'Gula'), 'purchase', 4, null, false
);
select is(
  (select current_qty from public.upsert_inventory_item(
    (select jsonb_build_object('id', id, 'name', 'Gula Halus', 'unit', 'g', 'min_qty', 3, 'unit_cost', 16000, 'is_active', true)
      from public.inventory_items where name = 'Gula')
  )),
  4::numeric,
  'edit bahan mempertahankan current_qty yang dikelola ledger'
);
select throws_ok(
  $$select public.upsert_inventory_item(
    (select jsonb_build_object('id', id, 'name', 'Gula Halus', 'unit', 'kg', 'min_qty', 3, 'unit_cost', 16000, 'is_active', true)
      from public.inventory_items where name = 'Gula Halus')
  )$$,
  'P0001',
  'INPUT_INVALID',
  'satuan tidak dapat berubah setelah ada pergerakan stok'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'inventory.item_update'),
  'pembuatan dan perubahan bahan tercatat di audit'
);

select * from finish();
rollback;
