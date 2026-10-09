begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000001401', 'authenticated', 'authenticated', 'return-admin@test.local', '', now()),
  ('00000000-0000-4000-8000-000000001402', 'authenticated', 'authenticated', 'return-super@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values
  ('00000000-0000-4000-8000-000000001401', 'return-admin@test.local', 'Admin Retur', 'admin'),
  ('00000000-0000-4000-8000-000000001402', 'return-super@test.local', 'Super Retur', 'super_admin');
insert into public.categories (id, name)
values ('00000000-0000-4000-8000-000000001410', 'Retur');
insert into public.menu_items (id, category_id, name, price)
values (
  '00000000-0000-4000-8000-000000001411',
  '00000000-0000-4000-8000-000000001410',
  'Menu Retur',
  10000
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001401', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001401","role":"authenticated"}', true);
set local role authenticated;
select public.open_shift(0);
select public.create_order(
  '00000000-0000-4000-8000-000000001499',
  'takeaway',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000001411","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  null,
  null,
  'none',
  '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
);
select public.change_order_status(
  (select id from public.orders where order_no like '%0001'), 'processing'
);
select public.change_order_status(
  (select id from public.orders where order_no like '%0001'), 'ready'
);
select public.change_order_status(
  (select id from public.orders where order_no like '%0001'), 'completed'
);

select throws_ok(
  $$select public.return_completed_order(
    (select id from public.orders where order_no like '%0001'), 'Retur oleh admin'
  )$$,
  'P0001',
  'NOT_AUTHORIZED',
  'admin tidak dapat mengembalikan pesanan selesai'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001402', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001402","role":"authenticated"}', true);
select is(
  (select status::text from public.return_completed_order(
    (select id from public.orders where order_no like '%0001'), 'Pesanan dikembalikan'
  )),
  'cancelled',
  'super admin dapat mengembalikan pesanan selesai'
);
select is(
  (select cancelled_from::text from public.orders where order_no like '%0001'),
  'completed',
  'asal status selesai tetap tercatat saat retur'
);
select is(
  (select sum(amount) from public.payments
   where order_id = (select id from public.orders where order_no like '%0001') and is_refund),
  -10000::bigint,
  'retur mencatat refund tunai bernilai negatif'
);
select throws_ok(
  $$select public.return_completed_order(
    (select id from public.orders where order_no like '%0001'), 'Retur ulang'
  )$$,
  'P0001',
  'ORDER_NOT_RETURNABLE',
  'pesanan yang sudah diretur tidak dapat diretur kembali'
);
set local role postgres;
select ok(
  exists (select 1 from public.audit_logs where action = 'order.return'),
  'retur tercatat di audit log'
);

select * from finish();
rollback;