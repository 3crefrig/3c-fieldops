-- ============================================================
-- SECURITY HARDENING (2026-07-10 audit)
-- Before: RLS "enabled" but rubber-stamp policies — users readable by ANON
-- (emails/roles/pay rates), proposals anonymously UPDATABLE, any Google
-- account = full read/write everywhere, scheduled_emails (invoice PDFs) had
-- RLS fully disabled. After: anon has ZERO direct table access (public
-- surfaces go through token-gated SECURITY DEFINER RPCs) and authenticated
-- access is scoped by app role via current_app_role()/current_app_user_id().
-- Untouched (already correct): rfqs, rfq_items, rfq_specs, push_subscriptions,
-- project_change_orders, email_refresh_log.
-- ============================================================

-- ---------- 0) Helper for the first-run bootstrap ----------
create or replace function public.users_table_empty()
returns boolean language sql security definer set search_path=public as
$$ select not exists (select 1 from public.users); $$;

-- ---------- 1) Token-gated RPCs replacing all anon table access ----------

-- Customer portal: WOs for one customer + hours-only time entries for those WOs.
-- (Previously the portal read ALL time_entries — tech names + descriptions — anonymously.)
create or replace function public.portal_customer_data(cust text)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'wos', coalesce((select jsonb_agg(jsonb_build_object(
        'id',w.id,'wo_id',w.wo_id,'customer_wo',w.customer_wo,'title',w.title,
        'status',w.status,'wo_type',w.wo_type,'location',w.location,'building',w.building,
        'due_date',w.due_date,'date_completed',w.date_completed,'work_performed',w.work_performed,
        'customer',w.customer)
        order by w.date_completed desc nulls last)
      from public.work_orders w where w.customer = cust), '[]'::jsonb),
    'time', coalesce((select jsonb_agg(jsonb_build_object('wo_id',t.wo_id,'hours',t.hours))
      from public.time_entries t
      where t.wo_id in (select id from public.work_orders where customer = cust)), '[]'::jsonb)
  );
$$;

-- Proposal portal: fetch by approval token (proposal + linked estimate).
create or replace function public.proposal_by_token(tok text)
returns jsonb language sql security definer set search_path=public as $$
  select case when p.id is null then null else jsonb_build_object(
    'proposal', to_jsonb(p) - 'approval_token',
    'estimate', (select to_jsonb(e) from public.estimates e where e.id = p.estimate_id)
  ) end
  from public.proposals p where p.approval_token = tok;
$$;

-- Proposal portal: customer approve/reject, token-validated server-side.
create or replace function public.proposal_respond(tok text, action text, reason text default null, selected_opt int default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.proposals; opt_label text;
begin
  select * into p from public.proposals where approval_token = tok;
  if p.id is null then return jsonb_build_object('ok',false,'error','invalid token'); end if;
  if p.status in ('approved','rejected') then return jsonb_build_object('ok',false,'error','already responded'); end if;
  if p.expires_at is not null and p.expires_at < now() then return jsonb_build_object('ok',false,'error','expired'); end if;
  if action = 'approve' then
    update public.proposals set status='approved', approved_at=now(), approved_by='Customer' where id=p.id;
    if p.estimate_id is not null then
      update public.estimates set status='approved', approved_at=now(),
        selected_option = coalesce(selected_opt, selected_option) where id=p.estimate_id;
      if selected_opt is not null then
        select (options->selected_opt->>'label') into opt_label from public.estimates where id=p.estimate_id;
      end if;
    end if;
    insert into public.notifications(type,title,message,for_role)
      values('proposal_approved','Proposal Approved', p.proposal_num||' approved by '||p.customer_name||coalesce(' — '||opt_label,''),'admin');
  elsif action = 'reject' then
    update public.proposals set status='rejected', rejected_at=now(), rejection_reason=left(coalesce(reason,''),500) where id=p.id;
    insert into public.notifications(type,title,message,for_role)
      values('proposal_rejected','Proposal Rejected', p.proposal_num||' rejected by '||p.customer_name||case when coalesce(reason,'')<>'' then ': '||left(reason,80) else '' end,'admin');
  else
    return jsonb_build_object('ok',false,'error','bad action');
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- Feedback form: fetch request by token (+ key-account flag).
create or replace function public.feedback_request_by_token(tok text)
returns jsonb language sql security definer set search_path=public as $$
  select case when r.id is null then null else
    to_jsonb(r) - 'token' || jsonb_build_object(
      'is_key_account', coalesce((select c.is_key_account from public.customers c where c.name=r.customer_name), false))
  end
  from public.feedback_requests r where r.token = tok;
$$;

grant execute on function public.portal_customer_data(text), public.proposal_by_token(text),
  public.proposal_respond(text,text,text,int), public.feedback_request_by_token(text),
  public.users_table_empty() to anon, authenticated;

-- ---------- 2) Drop ALL existing policies on managed tables, enable RLS ----------
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'users','customers','app_settings','purchase_orders',
    'work_orders','time_entries','photos','wo_activity','wo_field_notes','refrigerant_log',
    'kb_articles','kb_files','schedule','company_events','projects','project_chambers',
    'project_milestones','project_parts','project_notes','project_photos','project_drawings',
    'equipment','email_contacts','notifications','recurring_templates','scope_snippets',
    'invoices','scheduled_emails','estimates','proposals','wo_drafts','email_processing_log',
    'email_templates','workflows','workflow_runs','workflow_templates','service_agreements',
    'agreement_tiers','feedback','feedback_requests','wo_line_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- ---------- 3) Recreate scoped policies ----------
-- Base predicates:
--   app user:  current_app_role() is not null   (signed in AND registered+active)
--   manager+:  current_app_role() in ('admin','manager')
--   admin:     current_app_role() = 'admin'

-- users: any signed-in Google account may read (needed to distinguish
-- "Access Denied" from first-run setup); writes admin-only; bootstrap insert.
create policy users_select on public.users for select to authenticated using (true);
create policy users_insert on public.users for insert to authenticated
  with check (current_app_role()='admin'
    or (public.users_table_empty() and lower(email)=lower(coalesce(auth.jwt()->>'email',''))));
create policy users_update on public.users for update to authenticated
  using (current_app_role()='admin') with check (current_app_role()='admin');
create policy users_delete on public.users for delete to authenticated
  using (current_app_role()='admin');

-- App-user tables: full access for registered users only.
do $$
declare t text;
begin
  foreach t in array array[
    'work_orders','time_entries','photos','wo_activity','wo_field_notes','refrigerant_log',
    'kb_articles','kb_files','schedule','company_events','projects','project_chambers',
    'project_milestones','project_parts','project_notes','project_photos','project_drawings',
    'equipment','email_contacts','notifications','recurring_templates'
  ] loop
    execute format('create policy %I_app_all on public.%I for all to authenticated
      using (current_app_role() is not null) with check (current_app_role() is not null)', t, t);
  end loop;
end $$;

-- customers: app users read (pickers); manager+ write.
create policy customers_select on public.customers for select to authenticated
  using (current_app_role() is not null);
create policy customers_insert on public.customers for insert to authenticated
  with check (current_app_role() in ('admin','manager'));
create policy customers_update on public.customers for update to authenticated
  using (current_app_role() in ('admin','manager'));
create policy customers_delete on public.customers for delete to authenticated
  using (current_app_role() in ('admin','manager'));

-- app_settings: app users read (PO auto-approve threshold at PO create); admin write.
create policy app_settings_select on public.app_settings for select to authenticated
  using (current_app_role() is not null);
create policy app_settings_write on public.app_settings for all to authenticated
  using (current_app_role()='admin') with check (current_app_role()='admin');

-- purchase_orders: managers/admins all; technicians only their own requests.
create policy pos_select on public.purchase_orders for select to authenticated
  using (current_app_role() in ('admin','manager')
      or requested_by = (select name from public.users where id = current_app_user_id()));
create policy pos_insert on public.purchase_orders for insert to authenticated
  with check (current_app_role() is not null);
create policy pos_update on public.purchase_orders for update to authenticated
  using (current_app_role() in ('admin','manager')
      or requested_by = (select name from public.users where id = current_app_user_id()));
create policy pos_delete on public.purchase_orders for delete to authenticated
  using (current_app_role() in ('admin','manager')
      or requested_by = (select name from public.users where id = current_app_user_id()));

-- Money/office tables: manager+ only (public flows use the RPCs above).
do $$
declare t text;
begin
  foreach t in array array[
    'invoices','scheduled_emails','estimates','proposals','wo_drafts','email_processing_log',
    'email_templates','workflows','workflow_runs','workflow_templates','service_agreements',
    'agreement_tiers','feedback','feedback_requests','wo_line_items'
  ] loop
    execute format('create policy %I_mgr_all on public.%I for all to authenticated
      using (current_app_role() in (''admin'',''manager''))
      with check (current_app_role() in (''admin'',''manager''))', t, t);
  end loop;
end $$;

-- scope_snippets: app read, manager+ write (old policies checked auth.uid()
-- against users.id, which never matches — the app maps identity by email).
create policy snippets_select on public.scope_snippets for select to authenticated
  using (current_app_role() is not null);
create policy snippets_insert on public.scope_snippets for insert to authenticated
  with check (current_app_role() in ('admin','manager'));
create policy snippets_update on public.scope_snippets for update to authenticated
  using (current_app_role() in ('admin','manager'));
create policy snippets_delete on public.scope_snippets for delete to authenticated
  using (current_app_role() in ('admin','manager'));
