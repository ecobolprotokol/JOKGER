begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000001201', 'authenticated', 'authenticated', 'catalog-admin@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000001201', 'catalog-admin@test.local', 'Admin Katalog', 'admin');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001201","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select name from public.upsert_category('{"name":"Minuman","sort_order":1,"is_active":true}')),
  'Minuman',
  'kategori dibuat lewat RPC'
);
select is(
  (select name from public.upsert_category(
    (select jsonb_build_object('id', id, 'name', 'Minuman Dingin', 'sort_order', 2, 'is_active', true)
     from public.categories where name = 'Minuman')
  )),
  'Minuman Dingin',
  'kategori dapat diperbarui'
);
select is(
  (select name from public.upsert_menu_item(
    (select jsonb_build_object(
      'category_id', id, 'name', 'Es Teh', 'price', 8000,
      'description', 'Teh dingin', 'is_available', true, 'is_active', true,
      'sort_order', 1, 'modifier_group_ids', '[]'::jsonb
    ) from public.categories where name = 'Minuman Dingin')
  )),
  'Es Teh',
  'item menu dibuat dengan snapshot field yang valid'
);
select is(
  (select is_available from public.set_menu_item_available(
    (select id from public.menu_items where name = 'Es Teh'), false
  )),
  false,
  'ketersediaan menu dapat diubah lewat RPC'
);
select is(
  (select current_qty from public.upsert_inventory_item(
    '{"name":"Teh","unit":"g","min_qty":0,"unit_cost":100,"is_active":true}'
  )),
  0::numeric,
  'bahan resep dibuat tanpa mengubah stok'
);
select lives_ok(
  $$select public.upsert_recipe(
    (select id from public.menu_items where name = 'Es Teh'),
    (select jsonb_build_array(jsonb_build_object('inventory_item_id', id, 'qty_per_serving', 2.5))
     from public.inventory_items where name = 'Teh')
  )$$,
  'resep valid dapat disimpan'
);
select is(
  (select qty_per_serving from public.recipe_lines
   where menu_item_id = (select id from public.menu_items where name = 'Es Teh')),
  2.5::numeric,
  'resep menyimpan jumlah per porsi'
);
select is(
  (select price from public.upsert_menu_item(
    (select jsonb_build_object(
      'id', menu.id, 'category_id', menu.category_id, 'name', menu.name,
      'price', 9000, 'is_available', true, 'is_active', true, 'sort_order', menu.sort_order
    ) from public.menu_items menu where menu.name = 'Es Teh')
  )),
  9000::bigint,
  'harga menu dapat diperbarui melalui RPC'
);
select throws_ok(
  $$select public.upsert_menu_item(
    (select jsonb_build_object('category_id', id, 'name', 'Harga Salah', 'price', -1)
     from public.categories where name = 'Minuman Dingin')
  )$$,
  'P0001',
  'INPUT_INVALID',
  'harga negatif ditolak'
);
select throws_ok(
  $$select public.upsert_recipe(
    (select id from public.menu_items where name = 'Es Teh'),
    (select jsonb_build_array(jsonb_build_object('inventory_item_id', id, 'qty_per_serving', 0))
     from public.inventory_items where name = 'Teh')
  )$$,
  'P0001',
  'INPUT_INVALID',
  'jumlah resep nol ditolak'
);

select * from finish();
rollback;