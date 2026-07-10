-- Tighten Storage: uploads require a registered app user (not just any
-- authenticated Google account); deletes require manager+. Reads stay public
-- (object paths are unguessable UUIDs; flipping to private would require signed
-- URLs across project files, RFQ docx, and the customer portal — tracked as a
-- follow-up). Applies to project-files and rfq-docs buckets.
do $$
declare b text;
begin
  foreach b in array array['project-files','rfq-docs'] loop
    execute format('drop policy if exists %I on storage.objects', b||'_insert');
    execute format('drop policy if exists %I on storage.objects', b||'_delete');
    execute format('drop policy if exists %I on storage.objects', 'project_files_insert');
    execute format('drop policy if exists %I on storage.objects', 'project_files_delete');
  end loop;
end $$;

drop policy if exists "project_files_insert" on storage.objects;
drop policy if exists "project_files_delete" on storage.objects;

create policy "pf_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('project-files','rfq-docs') and public.current_app_role() is not null);
create policy "pf_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('project-files','rfq-docs') and public.current_app_role() in ('admin','manager'));
