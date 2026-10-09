begin;

select plan(6);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-000000000301',
  'authenticated',
  'authenticated',
  'status-admin@test.local',
  '',
  now()
);
insert into public.profiles (id, email, full_name, role)
values (
  '00000000-0000-4000-8000-000000000301',
  'status-admin@test.local',
  'Admin Status',
  'admin'
);
insert into public.categories (id, name) values ('00000000-0000-4000-8000-000000000310', 'Status');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000310', 'Menu Status', 10000);

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
  'takeaway',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000311","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  null,
  null,
  'none',
  '[{"method":"cash","amount":10000,"received_amount":10000,"payment_account_id":null,"reference_no":null,"proof_path":null}]'
);

select is(
  (select status::text from public.change_order_status(
    (select id from public.orders where order_no like '%0001'), 'processing'
  )),
  'processing',
  'pesanan baru dapat mulai diproses'
);
select is(
  (select status::text from public.change_order_status(
    (select id from public.orders where order_no like '%0001'), 'ready'
  )),
  'ready',
  'pesanan diproses dapat ditandai siap'
);
select is(
  (select status::text from public.change_order_status(
    (select id from public.orders where order_no like '%0001'), 'completed'
  )),
  'completed',
  'pesanan lunas dapat diselesaikan'
);
set local role postgres;
select ok(
  exists (
    select 1 from public.audit_logs
    where action = 'order.status_change'
      and payload->>'from' = 'ready'
      and payload->>'to' = 'completed'
  ),
  'audit menyimpan status asal dan tujuan'
);
set local role authenticated;
select throws_ok(
  $$select public.change_order_status((select id from public.orders where order_no like '%0001'), 'ready')$$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'status terminal tidak dapat kembali ke siap'
);

select public.create_order(
  '00000000-0000-4000-8000-000000000398',
  'dine_in',
  '[{"menu_item_id":"00000000-0000-4000-8000-000000000311","qty":1,"modifier_option_ids":[],"note":null}]',
  null,
  'C1',
  null,
  'open',
  '[]'
);
select public.change_order_status((select id from public.orders where table_label = 'C1'), 'processing');
select public.change_order_status((select id from public.orders where table_label = 'C1'), 'ready');
select throws_ok(
  $$select public.change_order_status((select id from public.orders where table_label = 'C1'), 'completed')$$,
  'P0001',
  'BILL_NOT_CLOSED',
  'open bill tidak dapat diselesaikan'
);

select * from finish();
rollback;
