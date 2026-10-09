begin;

select plan(2);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ),
  'orders tersedia pada publication realtime'
);
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ),
  'payments tersedia pada publication realtime'
);

select * from finish();
rollback;