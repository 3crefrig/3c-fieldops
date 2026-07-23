-- Knowledge Base photos v2: direct Supabase Storage uploads (public kb-files
-- bucket — same pattern as project-files, no Google Drive "request access"
-- wall) + photo captions for inline [photo:N] rendering in articles.
-- Additive only: no existing data or columns are touched.

insert into storage.buckets (id, name, public)
  values ('kb-files', 'kb-files', true)
  on conflict (id) do nothing;

alter table public.kb_files add column if not exists caption text;

-- Storage policies mirror project-files: uploads require a registered app
-- user; deletes require manager+. Reads stay public (unguessable paths).
drop policy if exists "kbf_insert" on storage.objects;
drop policy if exists "kbf_delete" on storage.objects;
create policy "kbf_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kb-files' and public.current_app_role() is not null);
create policy "kbf_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kb-files' and public.current_app_role() in ('admin','manager'));
