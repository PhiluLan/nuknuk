-- CTO Decision 005: additive Objective detail and trusted Evidence transport support.
-- Apply locally or to reviewed Staging only. Never apply from this worktree to Production.

alter table public.evidence
  add column if not exists source_version_ref text;

create table public.evidence_lineage (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  evidence_id uuid not null,
  parent_evidence_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  primary key (tenant_id, company_id, evidence_id, parent_evidence_id),
  check (evidence_id <> parent_evidence_id),
  foreign key (tenant_id, company_id, evidence_id)
    references public.evidence(tenant_id, company_id, id) on delete restrict,
  foreign key (tenant_id, company_id, parent_evidence_id)
    references public.evidence(tenant_id, company_id, id) on delete restrict
);
create index evidence_lineage_parent_scope_idx
  on public.evidence_lineage (tenant_id, company_id, parent_evidence_id);
alter table public.evidence_lineage enable row level security;
alter table public.evidence_lineage force row level security;
create policy evidence_lineage_select_member on public.evidence_lineage
  for select to authenticated
  using (app.has_active_membership(tenant_id, company_id));
create trigger evidence_lineage_immutable
  before update or delete on public.evidence_lineage
  for each row execute function app.prevent_immutable_mutation();

create or replace function app.create_objective_detailed(
  p_tenant_id uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_owner_organization_node_id uuid,
  p_target_date date,
  p_success_measure_refs jsonb,
  p_actor_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_objective_id uuid := gen_random_uuid();
  v_existing uuid;
  v_reference text;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select resource_id into v_existing
  from public.mutation_receipts
  where tenant_id=p_tenant_id and company_id=p_company_id
    and operation='objective.created' and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if p_owner_organization_node_id is not null and not exists (
    select 1 from public.organization_nodes
    where id=p_owner_organization_node_id and tenant_id=p_tenant_id and company_id=p_company_id
  ) then
    raise exception 'objective owner scope mismatch';
  end if;
  for v_reference in select jsonb_array_elements_text(coalesce(p_success_measure_refs, '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.metrics
      where tenant_id=p_tenant_id and company_id=p_company_id
        and (id::text=v_reference or metric_key=v_reference)
    ) then
      raise exception 'success measure reference is outside the requested tenant/company scope';
    end if;
  end loop;
  insert into public.objectives (
    id, tenant_id, company_id, owner_type, owner_id, owner_organization_node_id,
    title, description, target_date, success_measure_refs, created_by
  ) values (
    v_objective_id, p_tenant_id, p_company_id, 'human', p_actor_id,
    p_owner_organization_node_id, p_title, p_description, p_target_date,
    coalesce(p_success_measure_refs, '[]'::jsonb), p_actor_id
  );
  insert into public.mutation_receipts (tenant_id,company_id,operation,idempotency_key,resource_id,created_by)
    values (p_tenant_id,p_company_id,'objective.created',p_idempotency_key,v_objective_id,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id,summary)
    values (p_tenant_id,p_company_id,'human',p_actor_id,'objective.created','objective',v_objective_id,p_correlation_id,jsonb_build_object('target_date',p_target_date,'success_measure_refs',coalesce(p_success_measure_refs,'[]'::jsonb)));
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id,payload)
    values (p_tenant_id,p_company_id,'objective.created','objective',v_objective_id,p_actor_id,p_correlation_id,jsonb_build_object('target_date',p_target_date,'success_measure_refs',coalesce(p_success_measure_refs,'[]'::jsonb)));
  return v_objective_id;
end;
$$;

create or replace function app.record_evidence(
  p_tenant_id uuid,
  p_company_id uuid,
  p_evidence_type text,
  p_source text,
  p_content_pointer text,
  p_collected_at timestamptz,
  p_confidence numeric,
  p_classification text,
  p_freshness_seconds integer,
  p_content_hash text,
  p_source_version_ref text,
  p_parent_evidence_refs jsonb,
  p_actor_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_evidence_id uuid := gen_random_uuid();
  v_existing uuid;
  v_parent_ref text;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  if p_freshness_seconds < 0 then raise exception 'freshness seconds must be non-negative'; end if;
  if p_content_hash is not null and p_content_hash !~ '^sha256:[A-Fa-f0-9]{64}$' then
    raise exception 'content hash must be a sha256 hex digest';
  end if;
  if p_source_version_ref ~* '(password|secret|api[_-]?key|access[_-]?token|bearer[[:space:]]|://[^/[:space:]@:]+:[^@[:space:]]+@)' then
    raise exception 'source version reference contains credential-shaped data';
  end if;
  select resource_id into v_existing
  from public.mutation_receipts
  where tenant_id=p_tenant_id and company_id=p_company_id
    and operation='evidence.recorded' and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  for v_parent_ref in select jsonb_array_elements_text(coalesce(p_parent_evidence_refs, '[]'::jsonb))
  loop
    if v_parent_ref = v_evidence_id::text then raise exception 'evidence cannot reference itself as lineage'; end if;
    if not exists (
      select 1 from public.evidence
      where tenant_id=p_tenant_id and company_id=p_company_id and id::text=v_parent_ref
    ) then
      raise exception 'parent evidence reference is outside the requested tenant/company scope';
    end if;
  end loop;
  insert into public.evidence (
    id,tenant_id,company_id,evidence_type,source,content_pointer,collected_at,
    freshness_seconds,confidence,classification,content_hash,source_version_ref,created_by
  ) values (
    v_evidence_id,p_tenant_id,p_company_id,p_evidence_type,p_source,p_content_pointer,
    p_collected_at,p_freshness_seconds,p_confidence,p_classification,p_content_hash,
    p_source_version_ref,p_actor_id
  );
  insert into public.evidence_lineage (tenant_id,company_id,evidence_id,parent_evidence_id,created_by)
    select p_tenant_id,p_company_id,v_evidence_id,parent.id,p_actor_id
    from public.evidence parent
    where parent.tenant_id=p_tenant_id and parent.company_id=p_company_id
      and parent.id::text in (select jsonb_array_elements_text(coalesce(p_parent_evidence_refs, '[]'::jsonb)));
  insert into public.mutation_receipts (tenant_id,company_id,operation,idempotency_key,resource_id,created_by)
    values (p_tenant_id,p_company_id,'evidence.recorded',p_idempotency_key,v_evidence_id,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id,summary)
    values (p_tenant_id,p_company_id,'human',p_actor_id,'evidence.recorded','evidence',v_evidence_id,p_correlation_id,jsonb_build_object('parent_evidence_refs',coalesce(p_parent_evidence_refs,'[]'::jsonb)));
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id,payload)
    values (p_tenant_id,p_company_id,'evidence.recorded','evidence',v_evidence_id,p_actor_id,p_correlation_id,jsonb_build_object('parent_evidence_refs',coalesce(p_parent_evidence_refs,'[]'::jsonb)));
  return v_evidence_id;
end;
$$;

revoke all on function app.create_objective_detailed(uuid,uuid,text,text,uuid,date,jsonb,uuid,text,uuid) from public, anon, authenticated;
revoke all on function app.record_evidence(uuid,uuid,text,text,text,timestamptz,numeric,text,integer,text,text,jsonb,uuid,text,uuid) from public, anon, authenticated;
grant execute on function app.create_objective_detailed(uuid,uuid,text,text,uuid,date,jsonb,uuid,text,uuid) to service_role;
grant execute on function app.record_evidence(uuid,uuid,text,text,text,timestamptz,numeric,text,integer,text,text,jsonb,uuid,text,uuid) to service_role;
