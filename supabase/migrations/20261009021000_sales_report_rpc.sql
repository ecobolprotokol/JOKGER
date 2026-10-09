create function get_sales_report(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_ids uuid[];
  v_total_sales bigint;
  v_total_transactions bigint;
  v_total_refund bigint;
  v_total_discount bigint;
  v_total_service bigint;
  v_total_tax bigint;
  v_total_void bigint;
  v_daily jsonb;
  v_hourly jsonb;
  v_by_method jsonb;
  v_by_category jsonb;
  v_by_item jsonb;
  v_by_voucher jsonb;
begin
  if not is_staff() then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHORIZED';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from + 1 > 366 then
    raise exception using errcode = 'P0001', message = 'INPUT_INVALID';
  end if;

  select coalesce(array_agg(distinct p.order_id), array[]::uuid[])
  into v_order_ids
  from payments p
  where p.status = 'verified'
    and (p.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to;

  select coalesce(sum(p.amount), 0)::bigint,
         count(distinct p.order_id),
         coalesce(-sum(p.amount) filter (where p.is_refund), 0)::bigint
  into v_total_sales, v_total_transactions, v_total_refund
  from payments p
  where p.status = 'verified'
    and (p.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to;

  select coalesce(sum(discount_total), 0)::bigint,
         coalesce(sum(service_amount), 0)::bigint,
         coalesce(sum(tax_amount), 0)::bigint
  into v_total_discount, v_total_service, v_total_tax
  from orders where id = any(v_order_ids);
  select coalesce(sum(line_total), 0)::bigint
  into v_total_void
  from order_items where order_id = any(v_order_ids) and is_voided;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', local_date,
    'totalSales', total_sales,
    'totalTransactions', total_transactions
  ) order by local_date), '[]'::jsonb)
  into v_daily
  from (
    select (p.created_at at time zone 'Asia/Jakarta')::date as local_date,
           sum(p.amount)::bigint as total_sales,
           count(distinct p.order_id) as total_transactions
    from payments p
    where p.status = 'verified'
      and (p.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to
    group by (p.created_at at time zone 'Asia/Jakarta')::date
  ) daily;

  select coalesce(jsonb_agg(jsonb_build_object(
    'hour', local_hour,
    'totalSales', total_sales,
    'totalTransactions', total_transactions
  ) order by local_hour), '[]'::jsonb)
  into v_hourly
  from (
    select extract(hour from p.created_at at time zone 'Asia/Jakarta')::integer as local_hour,
           sum(p.amount)::bigint as total_sales,
           count(distinct p.order_id) as total_transactions
    from payments p
    where p.status = 'verified'
      and (p.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to
    group by extract(hour from p.created_at at time zone 'Asia/Jakarta')::integer
  ) hourly;

  select coalesce(jsonb_agg(jsonb_build_object('method', method, 'totalSales', total_sales) order by method), '[]'::jsonb)
  into v_by_method
  from (
    select p.method, sum(p.amount)::bigint as total_sales
    from payments p
    where p.status = 'verified'
      and (p.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to
    group by p.method
  ) methods;

  select coalesce(jsonb_agg(jsonb_build_object(
    'categoryName', category_name,
    'totalQty', total_qty,
    'totalSales', total_sales
  ) order by category_name), '[]'::jsonb)
  into v_by_category
  from (
    select c.name as category_name,
           sum(oi.qty)::bigint as total_qty,
           sum(oi.line_total)::bigint as total_sales
    from order_items oi
    join menu_items mi on mi.id = oi.menu_item_id
    join categories c on c.id = mi.category_id
    where oi.order_id = any(v_order_ids) and not oi.is_voided
    group by c.name
  ) categories;

  select coalesce(jsonb_agg(jsonb_build_object(
    'itemName', item_name,
    'categoryName', category_name,
    'totalQty', total_qty,
    'totalSales', total_sales
  ) order by item_name, category_name), '[]'::jsonb)
  into v_by_item
  from (
    select oi.item_name,
           c.name as category_name,
           sum(oi.qty)::bigint as total_qty,
           sum(oi.line_total)::bigint as total_sales
    from order_items oi
    join menu_items mi on mi.id = oi.menu_item_id
    join categories c on c.id = mi.category_id
    where oi.order_id = any(v_order_ids) and not oi.is_voided
    group by oi.item_name, c.name
  ) items;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', v.code,
    'name', v.name,
    'usageCount', usage_count,
    'totalDiscount', total_discount
  ) order by v.code), '[]'::jsonb)
  into v_by_voucher
  from (
    select o.voucher_id,
           count(*)::bigint as usage_count,
           sum(o.discount_total)::bigint as total_discount
    from orders o
    where o.id = any(v_order_ids) and o.voucher_id is not null
    group by o.voucher_id
  ) voucher_totals
  join vouchers v on v.id = voucher_totals.voucher_id;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'totalSales', v_total_sales,
      'totalTransactions', v_total_transactions,
      'avgTransaction', case when v_total_transactions = 0 then 0
        else round(v_total_sales::numeric / v_total_transactions)::bigint end,
      'totalRefund', v_total_refund,
      'totalDiscount', v_total_discount,
      'totalService', v_total_service,
      'totalTax', v_total_tax,
      'totalVoid', v_total_void
    ),
    'daily', v_daily,
    'hourly', v_hourly,
    'byMethod', v_by_method,
    'byCategory', v_by_category,
    'byItem', v_by_item,
    'byVoucher', v_by_voucher
  );
end;
$$;

revoke all on function get_sales_report(date, date) from public, anon;
grant execute on function get_sales_report(date, date) to authenticated;