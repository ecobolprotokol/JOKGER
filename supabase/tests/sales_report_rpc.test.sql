begin;

select plan(15);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values ('00000000-0000-4000-8000-000000002101', 'authenticated', 'authenticated', 'report-admin@test.local', '', now());
insert into public.profiles (id, email, full_name, role)
values ('00000000-0000-4000-8000-000000002101', 'report-admin@test.local', 'Admin Report', 'admin');
insert into public.shifts (id, opened_by, opening_cash)
values ('00000000-0000-4000-8000-000000002102', '00000000-0000-4000-8000-000000002101', 5000);
insert into public.categories (id, name)
values ('00000000-0000-4000-8000-000000002103', 'Report Category');
insert into public.menu_items (id, category_id, name, price)
values ('00000000-0000-4000-8000-000000002104', '00000000-0000-4000-8000-000000002103', 'Report Item', 10000);
insert into public.vouchers (id, code, name, type, value, valid_from, valid_until)
values ('00000000-0000-4000-8000-000000002105', 'REPORT10', 'Voucher Report', 'percent', 10, now() - interval '1 day', now() + interval '1 day');
insert into public.orders (
  id, order_no, shift_id, order_type, status, subtotal, discount_total, grand_total,
  voucher_id, voucher_code, created_by
) values
  ('00000000-0000-4000-8000-000000002106', 'JKG-20260102-0001', '00000000-0000-4000-8000-000000002102', 'takeaway', 'completed', 10000, 500, 9500, '00000000-0000-4000-8000-000000002105', 'REPORT10', '00000000-0000-4000-8000-000000002101'),
  ('00000000-0000-4000-8000-000000002107', 'JKG-20260102-0002', '00000000-0000-4000-8000-000000002102', 'takeaway', 'completed', 50000, 0, 50000, null, null, '00000000-0000-4000-8000-000000002101'),
  ('00000000-0000-4000-8000-000000002108', 'JKG-20260103-0001', '00000000-0000-4000-8000-000000002102', 'takeaway', 'completed', 7000, 0, 7000, null, null, '00000000-0000-4000-8000-000000002101');
insert into public.order_items (order_id, menu_item_id, item_name, unit_price, qty, line_total, is_voided)
values
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-000000002104', 'Report Item', 9000, 1, 9000, false),
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-000000002104', 'Voided Item', 1000, 1, 1000, true);
insert into public.payments (
  order_id, shift_id, method, amount, is_refund, status, created_by, created_at
) values
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-000000002102', 'cash', 10000, false, 'verified', '00000000-0000-4000-8000-000000002101', '2026-01-02 16:30:00+00'),
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-000000002102', 'cash', -2000, true, 'verified', '00000000-0000-4000-8000-000000002101', '2026-01-02 16:35:00+00'),
  ('00000000-0000-4000-8000-000000002107', '00000000-0000-4000-8000-000000002102', 'cash', 50000, false, 'rejected', '00000000-0000-4000-8000-000000002101', '2026-01-02 16:45:00+00'),
  ('00000000-0000-4000-8000-000000002108', '00000000-0000-4000-8000-000000002102', 'transfer', 7000, false, 'verified', '00000000-0000-4000-8000-000000002101', '2026-01-03 17:30:00+00');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002101","role":"authenticated"}', true);
set local role authenticated;

select is(
  (public.get_sales_report('2026-01-02', '2026-01-02')->'summary'->>'totalSales')::bigint,
  8000::bigint, 'total laporan sama dengan pembayaran verified termasuk refund negatif'
);
select ok(
  public.get_sales_report('2026-01-02', '2026-01-02') ?& array['summary', 'daily', 'hourly', 'byMethod', 'byCategory', 'byItem', 'byVoucher']
    and public.get_sales_report('2026-01-02', '2026-01-02')->'summary' ?& array[
      'totalSales', 'totalTransactions', 'avgTransaction', 'totalRefund', 'totalDiscount',
      'totalService', 'totalTax', 'totalVoid'
    ],
  'laporan memiliki nama key kontrak yang tepat'
);
select is(
  (public.get_sales_report('2026-01-02', '2026-01-02')->'summary'->>'totalTransactions')::bigint,
  1::bigint, 'transaksi dihitung per order unik dan pembayaran rejected dikecualikan'
);
select is(
  (public.get_sales_report('2026-01-02', '2026-01-02')->'summary'->>'totalRefund')::bigint,
  2000::bigint, 'refund ditampilkan sebagai nilai positif'
);
select is(
  (public.get_sales_report('2026-01-02', '2026-01-02')->'summary'->>'totalDiscount')::bigint,
  500::bigint, 'diskon dihitung sekali per order'
);
select is(
  (public.get_sales_report('2026-01-02', '2026-01-02')->'summary'->>'totalVoid')::bigint,
  1000::bigint, 'nilai item void ditampilkan terpisah'
);
select is(
  jsonb_array_length(public.get_sales_report('2026-01-02', '2026-01-02')->'byItem'),
  1, 'byItem mengecualikan item void'
);
select is(
  public.get_sales_report('2026-01-02', '2026-01-02')->'byItem'->0->>'totalSales',
  '9000', 'byItem memakai line_total sebelum diskon'
);
select is(
  public.get_sales_report('2026-01-02', '2026-01-02')->'daily'->0->>'date',
  '2026-01-02', 'tanggal 23:30 WIB dikelompokkan pada tanggal Jakarta'
);
select is(
  public.get_sales_report('2026-01-02', '2026-01-02')->'hourly'->0->>'hour',
  '23', 'jam pembayaran menggunakan zona Asia/Jakarta'
);
select is(
  public.get_sales_report('2026-01-02', '2026-01-02')->'byVoucher'->0->>'usageCount',
  '1', 'voucher dihitung dari order unik'
);
select ok(
  public.get_sales_report('2025-01-01', '2026-01-01') ? 'summary',
  'rentang inklusif 366 hari diterima'
);
select throws_ok(
  $$select public.get_sales_report('2024-12-31', '2026-01-01')$$,
  'P0001', 'INPUT_INVALID', 'rentang di atas 366 hari ditolak'
);
select throws_ok(
  $$select public.get_sales_report('2026-01-03', '2026-01-02')$$,
  'P0001', 'INPUT_INVALID', 'tanggal awal setelah tanggal akhir ditolak'
);
select is(
  (select expected_cash from public.close_shift(13000, null)),
  13000::bigint, 'expected_cash sama dengan saldo awal ditambah pembayaran tunai verified termasuk refund'
);

select * from finish();
rollback;