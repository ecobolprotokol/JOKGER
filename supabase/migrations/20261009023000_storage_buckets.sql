insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('public-assets', 'public-assets', true, 1048576, array['image/png', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'payment_proofs_read_staff') then
    create policy payment_proofs_read_staff on storage.objects
      for select to authenticated using (bucket_id = 'payment-proofs' and public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'payment_proofs_insert_staff') then
    create policy payment_proofs_insert_staff on storage.objects
      for insert to authenticated with check (bucket_id = 'payment-proofs' and public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_read_public') then
    create policy public_assets_read_public on storage.objects
      for select to anon, authenticated using (bucket_id = 'public-assets');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_insert_staff') then
    create policy public_assets_insert_staff on storage.objects
      for insert to authenticated with check (bucket_id = 'public-assets' and public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_update_staff') then
    create policy public_assets_update_staff on storage.objects
      for update to authenticated
      using (bucket_id = 'public-assets' and public.is_staff())
      with check (bucket_id = 'public-assets' and public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'public_assets_delete_staff') then
    create policy public_assets_delete_staff on storage.objects
      for delete to authenticated using (bucket_id = 'public-assets' and public.is_staff());
  end if;
end;
$$;