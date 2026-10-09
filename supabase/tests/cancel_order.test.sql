begin;

select plan(5);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000501',
  'authenticated',
  'authenticated',
  'cancel-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000501',
  'cancel-admin@test.local',
  'Admin Cancel',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000000510', 'Cancel');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000510', 'Menu Cancel', 10000);
insert into public.inventory_items (id, name, unit, current_qty)
values ('00000000-0000-4000-8000-000000000512', 'Bahan Cancel', 'g', 3);
insert into public.recipe_lines (menu_item_id, inventory_item_id, qty_per_serving)
values ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000512', 1);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated"}',
  true
);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000000599',
  'takeaway',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000511","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  null,
  null,
  'none',
  '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
);

select is(
  (select status::text from public.cancel_order(
    (select id from public.orders where order_no like '%0001'), 'Pelanggan batal'
  )),
  'cancelled',
  'pesanan baru dapat dibatalkan'
);
select is(
  (select amount from public.payments where order_id = (select id from public.orders where order_no like '%0001') and is_refund),
  -10000::bigint,
  'pembayaran tunai verified menghasilkan refund negatif'
);
select is(
  (select current_qty from public.inventory_items where id = '00000000-0000-4000-8000-000000000512'),
  3::numeric,
  'pembatalan mengembalikan stok resep'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'order.cancel')
    and exists (select 1 from public.audit_logs where action = 'payment.refund'),
  'pembatalan dan refund tercatat di audit'
);
set local role authenticated;
select throws_ok(
  $$select public.cancel_order((select id from public.orders where order_no like '%0001'), 'Pelanggan batal')$$,
  'P0001',
  'ORDER_NOT_CANCELLABLE',
  'pesanan terminal tidak dapat dibatalkan ulang'
);

select * from finish();
rollback;
