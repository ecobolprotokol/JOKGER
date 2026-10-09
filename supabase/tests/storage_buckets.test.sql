begin;

select plan(5);

select ok(
  exists (select 1 from storage.buckets where id = 'payment-proofs' and not public and file_size_limit = 5242880
    and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']),
  'payment-proofs privat, maksimal 5 MiB dan MIME dibatasi'
);
select ok(
  exists (select 1 from storage.buckets where id = 'public-assets' and public and file_size_limit = 1048576
    and allowed_mime_types = array['image/png', 'image/svg+xml', 'image/webp']),
  'public-assets publik, maksimal 1 MiB dan MIME dibatasi'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'payment_proofs_read_staff')
    and exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'payment_proofs_insert_staff'),
  'staff dapat membaca dan mengunggah payment-proofs'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_read_public'),
  'public-assets dapat dibaca publik'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_insert_staff')
    and exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_update_staff')
    and exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_delete_staff'),
  'staff dapat membuat, memperbarui, dan menghapus public-assets'
);
select * from finish();
rollback;