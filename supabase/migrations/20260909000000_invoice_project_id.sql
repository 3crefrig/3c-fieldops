-- Invoices billed to a project by line items only carry no wo_ids, so the project's
-- Invoices tab could not find them (four #4486 SoM Cold Room bills, $77,900, were
-- invisible on 2026-09-09). Give invoices an explicit project link and backfill.
alter table public.invoices add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists invoices_project_id_idx on public.invoices(project_id);

-- Backfill 1: any invoice that lists a project WO (by WO-#### or by uuid).
update public.invoices i
   set project_id = w.project_id
  from public.work_orders w
 where i.project_id is null
   and w.project_id is not null
   and (i.wo_ids @> array[w.wo_id] or i.wo_ids @> array[w.id::text]);

-- Backfill 2: line-item-only project bills — same customer and the job description
-- names the project (the generator prefills job_desc with the project name).
update public.invoices i
   set project_id = p.id
  from public.projects p
 where i.project_id is null
   and i.customer = p.customer
   and i.job_desc ilike '%' || p.name || '%';
