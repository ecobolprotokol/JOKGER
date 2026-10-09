begin;

select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000001801', 'authenticated', 'authenticated', 'voucher-apply@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000001801', 'voucher-apply@test.local', 'Admin Voucher Apply', 'admin');
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000001810', 'Voucher Apply');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000001811', '00000000-0000-4000-8000-000000001810', 'Menu Voucher Apply', 10000);
insert into public.vouchers (id, code, name, type, value, min_subtotal, valid_from, valid_until, total_quota)
values
  ('00000000-0000-4000-8000-000000001812', 'APPLY10', 'Diskon Sepuluh', 'percent', 10, 0, now() - interval '1 day', now() + interval '1 day', 10),
  ('00000000-0000-4000-8000-000000001813', 'FULL1', 'Kuota Habis', 'nominal', 1000, 0, now() - interval '1 day', now() + interval '1 day', 1),
  ('00000000-0000-4000-8000-000000001814', 'MINIMUM', 'Minimum Belanja', 'nominal', 1000, 20000, now() - interval '1 day', now() + interval '1 day', 10),
  ('00000000-0000-4000-8000-000000001815', 'VOIDMIN', 'Minimum Void', 'nominal', 1000, 15000, now() - interval '1 day', now() + interval '1 day', 10);
update public.vouchers set used_count = 1 where code = 'FULL1';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001801","role":"authenticated"}', true);
set local role authenticated;
select public.open_shift(0);
select public.create_order('00000000-0000-4000-8000-000000001891', 'takeaway', '[{"menu_item_id":"00000000-0000-4000-8000-000000001811","qty":1}]', null, null, null, 'none', '[]');

select is(
  (select discount_total from public.apply_voucher((select id from public.orders limit 1), 'apply10')),
  1000::bigint,
  'voucher berhasil diterapkan dan total dihitung ulang'
);
select throws_ok(
  $$select public.apply_voucher((select id from public.orders limit 1), 'APPLY10')$$,
  'P0001', 'VOUCHER_ALREADY_APPLIED', 'voucher kedua pada order yang sama ditolak'
);
select throws_ok(
  $$select public.apply_voucher((select id from public.orders limit 1), 'FULL1')$$,
  'P0001', 'VOUCHER_QUOTA_EXCEEDED', 'voucher dengan kuota habis ditolak'
);
select throws_ok(
  $$select public.apply_voucher((select id from public.orders limit 1), 'MINIMUM')$$,
  'P0001', 'VOUCHER_MIN_SUBTOTAL', 'minimum belanja yang tidak terpenuhi ditolak'
);
select is(
  (select discount_total from public.remove_voucher((select id from public.orders limit 1), 'Permintaan pelanggan')),
  0::bigint,
  'remove voucher mengembalikan total ke nilai tanpa diskon'
);
select is((select used_count from public.vouchers where code = 'APPLY10'), 0, 'remove voucher mengembalikan kuota');

select public.create_order('00000000-0000-4000-8000-000000001892', 'takeaway', '[{"menu_item_id":"00000000-0000-4000-8000-000000001811","qty":2}]', null, null, null, 'none', '[]');
select public.apply_voucher((select id from public.orders order by created_at desc limit 1), 'VOIDMIN');
select public.void_order_item(
  (select id from public.order_items where order_id = (select id from public.orders order by created_at desc limit 1) order by created_at limit 1),
  'Item dibatalkan'
);
select is(
  (select voucher_id::text from public.orders order by created_at desc limit 1),
  null::text,
  'void melepas voucher ketika subtotal turun di bawah minimum (D15)'
);
select is((select used_count from public.vouchers where code = 'VOIDMIN'), 0, 'void D15 mengembalikan kuota voucher');

select * from finish();
rollback;