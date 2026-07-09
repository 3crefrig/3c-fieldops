-- Project Files — additive. Generalizes project_drawings into a full "Files"
-- area (any file type, categorized) backed by a public Supabase Storage bucket
-- so techs get direct URLs that open on any device (no Google-Drive access wall).

alter table public.project_drawings
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists category text default 'document';

-- Public bucket for project files (direct public URLs).
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', true)
on conflict (id) do nothing;

-- Storage policies: public read (bucket is public anyway), authenticated upload/delete.
drop policy if exists "project_files_read" on storage.objects;
create policy "project_files_read" on storage.objects for select
  using (bucket_id = 'project-files');

drop policy if exists "project_files_insert" on storage.objects;
create policy "project_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files');

drop policy if exists "project_files_delete" on storage.objects;
create policy "project_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files');
