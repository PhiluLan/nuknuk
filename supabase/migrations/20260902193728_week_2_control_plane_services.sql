-- Week 2: server-only Control Plane service seams.
-- This migration is additive and is intended for a clean local Supabase instance only.
-- Never apply from this worktree to Staging or Production.

alter table public.agent_charters
  add column if not exists allowed_data_capabilities jsonb not null default '[]'::jsonb,
  add column if not exists allowed_tool_capabilities jsonb not null default '[]'::jsonb;

alter table public.objectives
  add column if not exists description text not null default '',
  add column if not exists owner_organization_node_id uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'objectives_owner_organization_node_scope_fkey'
      and conrelid = 'public.objectives'::regclass
  ) then
    alter table public.objectives
      add constraint objectives_owner_organization_node_scope_fkey
      foreign key (tenant_id, company_id, owner_organization_node_id)
      references public.organization_nodes(tenant_id, company_id, id)
      on delete restrict;
  end if;
end;
$$;

alter table public.agent_runs
  add column if not exists runtime_output jsonb,
  add column if not exists presented_at timestamptz;

create table if not exists public.mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  operation text not null check (operation ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 256),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, company_id, operation, idempotency_key),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict
);
create index if not exists mutation_receipts_scope_idx
  on public.mutation_receipts (tenant_id, company_id, operation, created_at desc);

alter table public.mutation_receipts enable row level security;
alter table public.mutation_receipts force row level security;
create policy mutation_receipts_select_member on public.mutation_receipts
  for select to authenticated
  using (app.has_active_membership(tenant_id, company_id));
create trigger mutation_receipts_immutable
  before update or delete on public.mutation_receipts
  for each row execute function app.prevent_immutable_mutation();

create or replace function app.create_agent_charter_version(
  p_tenant_id uuid,
  p_company_id uuid,
  p_organization_node_id uuid,
  p_mission text,
  p_responsibilities jsonb,
  p_allowed_data_capabilities jsonb,
  p_allowed_tool_capabilities jsonb,
  p_actor_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_charter_id uuid := gen_random_uuid();
  v_version integer;
  v_existing uuid;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select resource_id into v_existing from public.mutation_receipts
    where tenant_id = p_tenant_id and company_id = p_company_id
      and operation = 'agent_charter.created' and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if not exists (select 1 from public.organization_nodes where id = p_organization_node_id and tenant_id = p_tenant_id and company_id = p_company_id) then
    raise exception 'organization node scope mismatch';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.agent_charters
    where tenant_id = p_tenant_id and company_id = p_company_id and organization_node_id = p_organization_node_id;
  insert into public.agent_charters (
    id, tenant_id, company_id, organization_node_id, version, mission,
    responsibilities, forbidden_actions, authority_level,
    allowed_data_capabilities, allowed_tool_capabilities, created_by
  ) values (
    v_charter_id, p_tenant_id, p_company_id, p_organization_node_id, v_version, p_mission,
    p_responsibilities, '[]'::jsonb, 'human_only',
    p_allowed_data_capabilities, p_allowed_tool_capabilities, p_actor_id
  );
  insert into public.mutation_receipts (tenant_id, company_id, operation, idempotency_key, resource_id, created_by)
    values (p_tenant_id, p_company_id, 'agent_charter.created', p_idempotency_key, v_charter_id, p_actor_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary)
    values (p_tenant_id, p_company_id, 'human', p_actor_id, 'agent_charter.created', 'agent_charter', v_charter_id, p_correlation_id, jsonb_build_object('organization_node_id', p_organization_node_id, 'version', v_version));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload)
    values (p_tenant_id, p_company_id, 'agent_charter.created', 'agent_charter', v_charter_id, p_actor_id, p_correlation_id, jsonb_build_object('organization_node_id', p_organization_node_id, 'version', v_version));
  return v_charter_id;
end;
$$;

create or replace function app.create_objective(
  p_tenant_id uuid,
  p_company_id uuid,
  p_title text,
  p_description text,
  p_owner_organization_node_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_objective_id uuid := gen_random_uuid(); v_existing uuid;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select resource_id into v_existing from public.mutation_receipts where tenant_id=p_tenant_id and company_id=p_company_id and operation='objective.created' and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if p_owner_organization_node_id is not null and not exists (select 1 from public.organization_nodes where id=p_owner_organization_node_id and tenant_id=p_tenant_id and company_id=p_company_id) then
    raise exception 'objective owner scope mismatch';
  end if;
  insert into public.objectives (id, tenant_id, company_id, owner_type, owner_id, owner_organization_node_id, title, description, created_by)
    values (v_objective_id, p_tenant_id, p_company_id, 'human', p_actor_id, p_owner_organization_node_id, p_title, p_description, p_actor_id);
  insert into public.mutation_receipts (tenant_id, company_id, operation, idempotency_key, resource_id, created_by)
    values (p_tenant_id,p_company_id,'objective.created',p_idempotency_key,v_objective_id,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id,summary)
    values (p_tenant_id,p_company_id,'human',p_actor_id,'objective.created','objective',v_objective_id,p_correlation_id,jsonb_build_object('owner_organization_node_id', p_owner_organization_node_id));
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id,payload)
    values (p_tenant_id,p_company_id,'objective.created','objective',v_objective_id,p_actor_id,p_correlation_id,jsonb_build_object('owner_organization_node_id', p_owner_organization_node_id));
  return v_objective_id;
end;
$$;

create or replace function app.record_evidence(
  p_tenant_id uuid, p_company_id uuid, p_evidence_type text, p_source text,
  p_content_pointer text, p_collected_at timestamptz, p_confidence numeric,
  p_classification text, p_actor_id uuid, p_idempotency_key text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_evidence_id uuid := gen_random_uuid(); v_existing uuid;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select resource_id into v_existing from public.mutation_receipts where tenant_id=p_tenant_id and company_id=p_company_id and operation='evidence.recorded' and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  insert into public.evidence (id,tenant_id,company_id,evidence_type,source,content_pointer,collected_at,confidence,classification,created_by)
    values (v_evidence_id,p_tenant_id,p_company_id,p_evidence_type,p_source,p_content_pointer,p_collected_at,p_confidence,p_classification,p_actor_id);
  insert into public.mutation_receipts (tenant_id,company_id,operation,idempotency_key,resource_id,created_by) values (p_tenant_id,p_company_id,'evidence.recorded',p_idempotency_key,v_evidence_id,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'evidence.recorded','evidence',v_evidence_id,p_correlation_id);
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'evidence.recorded','evidence',v_evidence_id,p_actor_id,p_correlation_id);
  return v_evidence_id;
end;
$$;

create or replace function app.record_state_observation(
  p_tenant_id uuid, p_company_id uuid, p_metric_key text, p_value jsonb, p_unit text,
  p_observed_at timestamptz, p_ingested_at timestamptz, p_evidence_id uuid,
  p_freshness_seconds integer, p_confidence numeric, p_owner_id uuid,
  p_actor_id uuid, p_idempotency_key text, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_metric_id uuid; v_observation_id uuid := gen_random_uuid(); v_existing uuid;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select resource_id into v_existing from public.mutation_receipts where tenant_id=p_tenant_id and company_id=p_company_id and operation='state_observation.recorded' and idempotency_key=p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  insert into public.metrics (tenant_id, company_id, metric_key, name, unit, created_by)
    values (p_tenant_id,p_company_id,p_metric_key,p_metric_key,p_unit,p_actor_id)
    on conflict (tenant_id,company_id,metric_key) do update set unit = excluded.unit
    returning id into v_metric_id;
  insert into public.state_observations (id,tenant_id,company_id,metric_id,value,evidence_id,observed_at,ingested_at,freshness_seconds,confidence,owner_id,created_by)
    values (v_observation_id,p_tenant_id,p_company_id,v_metric_id,p_value,p_evidence_id,p_observed_at,p_ingested_at,p_freshness_seconds,p_confidence,p_owner_id,p_actor_id);
  insert into public.mutation_receipts (tenant_id,company_id,operation,idempotency_key,resource_id,created_by) values (p_tenant_id,p_company_id,'state_observation.recorded',p_idempotency_key,v_observation_id,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'state_observation.recorded','state_observation',v_observation_id,p_correlation_id);
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'state_observation.recorded','state_observation',v_observation_id,p_actor_id,p_correlation_id);
  return v_observation_id;
end;
$$;

create or replace function app.attach_run_context_manifest(
  p_tenant_id uuid, p_company_id uuid, p_agent_id uuid, p_run_id uuid,
  p_manifest_pointer text, p_manifest_hash text, p_evidence_refs jsonb,
  p_actor_id uuid, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_manifest_id uuid := gen_random_uuid();
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  if not exists (select 1 from public.agent_runs where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id and agent_id=p_agent_id and state='assembling_context') then raise exception 'run scope or state mismatch'; end if;
  insert into public.run_context_manifests (id,tenant_id,company_id,run_id,manifest_pointer,manifest_hash,evidence_refs,created_by)
    values (v_manifest_id,p_tenant_id,p_company_id,p_run_id,p_manifest_pointer,p_manifest_hash,p_evidence_refs,p_actor_id)
    on conflict (tenant_id,company_id,run_id) do update set manifest_pointer=excluded.manifest_pointer, manifest_hash=excluded.manifest_hash, evidence_refs=excluded.evidence_refs;
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'agent_run.context_attached','agent_run',p_run_id,p_correlation_id);
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'agent_run.context_attached','agent_run',p_run_id,p_actor_id,p_correlation_id);
  return v_manifest_id;
end;
$$;

create or replace function app.record_usage(
  p_tenant_id uuid,p_company_id uuid,p_agent_id uuid,p_run_id uuid,p_provider text,p_model text,
  p_input_tokens integer,p_output_tokens integer,p_estimated_cost_cents integer,p_actor_id uuid,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_usage_id uuid := gen_random_uuid();
begin
  perform app.assert_active_operator(p_tenant_id,p_company_id,p_actor_id);
  if not exists (select 1 from public.agent_runs where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id and agent_id=p_agent_id) then raise exception 'usage run scope mismatch'; end if;
  insert into public.usage_records (id,tenant_id,company_id,agent_id,run_id,provider,model,input_tokens,output_tokens,estimated_cost_cents,created_by)
    values (v_usage_id,p_tenant_id,p_company_id,p_agent_id,p_run_id,p_provider,p_model,p_input_tokens,p_output_tokens,p_estimated_cost_cents,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'usage.recorded','usage_record',v_usage_id,p_correlation_id);
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'usage.recorded','usage_record',v_usage_id,p_actor_id,p_correlation_id);
  return v_usage_id;
end;
$$;

create or replace function app.persist_awaiting_authority_output(
  p_tenant_id uuid,p_company_id uuid,p_agent_id uuid,p_run_id uuid,p_runtime_output jsonb,
  p_output_pointer text,p_actor_id uuid,p_correlation_id uuid default gen_random_uuid()
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform app.assert_active_operator(p_tenant_id,p_company_id,p_actor_id);
  if not exists (select 1 from public.agent_runs where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id and agent_id=p_agent_id and state='running') then raise exception 'run scope or state mismatch'; end if;
  if p_runtime_output->>'run_id' <> p_run_id::text or p_runtime_output->>'tenant_id' <> p_tenant_id::text or p_runtime_output->>'company_id' <> p_company_id::text or p_runtime_output->>'agent_id' <> p_agent_id::text then
    raise exception 'runtime output scope mismatch';
  end if;
  update public.agent_runs set state='awaiting_authority', runtime_output=p_runtime_output, output_pointer=p_output_pointer, presented_at=now(), updated_at=now()
    where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id and agent_id=p_agent_id;
  insert into public.proposals (tenant_id,company_id,agent_run_id,content_pointer,created_by) values (p_tenant_id,p_company_id,p_run_id,p_output_pointer,p_actor_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'agent_run.awaiting_authority','agent_run',p_run_id,p_correlation_id);
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'agent_run.awaiting_authority','agent_run',p_run_id,p_actor_id,p_correlation_id);
end;
$$;

revoke all on function app.create_agent_charter_version(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,uuid,text,uuid) from public, anon, authenticated;
revoke all on function app.create_objective(uuid,uuid,text,text,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function app.record_evidence(uuid,uuid,text,text,text,timestamptz,numeric,text,uuid,text,uuid) from public, anon, authenticated;
revoke all on function app.record_state_observation(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,uuid,integer,numeric,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function app.attach_run_context_manifest(uuid,uuid,uuid,uuid,text,text,jsonb,uuid,uuid) from public, anon, authenticated;
revoke all on function app.record_usage(uuid,uuid,uuid,uuid,text,text,integer,integer,integer,uuid,uuid) from public, anon, authenticated;
revoke all on function app.persist_awaiting_authority_output(uuid,uuid,uuid,uuid,jsonb,text,uuid,uuid) from public, anon, authenticated;
grant execute on function app.create_agent_charter_version(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,uuid,text,uuid) to service_role;
grant execute on function app.create_objective(uuid,uuid,text,text,uuid,uuid,text,uuid) to service_role;
grant execute on function app.record_evidence(uuid,uuid,text,text,text,timestamptz,numeric,text,uuid,text,uuid) to service_role;
grant execute on function app.record_state_observation(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,uuid,integer,numeric,uuid,uuid,text,uuid) to service_role;
grant execute on function app.attach_run_context_manifest(uuid,uuid,uuid,uuid,text,text,jsonb,uuid,uuid) to service_role;
grant execute on function app.record_usage(uuid,uuid,uuid,uuid,text,text,integer,integer,integer,uuid,uuid) to service_role;
grant execute on function app.persist_awaiting_authority_output(uuid,uuid,uuid,uuid,jsonb,text,uuid,uuid) to service_role;

create or replace function app.assert_active_member(
  p_tenant_id uuid, p_company_id uuid, p_actor_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and company_id = p_company_id
      and user_id = p_actor_id and status = 'active'
  ) then
    raise exception 'active membership required';
  end if;
end;
$$;

create or replace function app.read_organization_graph(
  p_tenant_id uuid, p_company_id uuid, p_actor_id uuid
)
returns jsonb
language sql security definer set search_path = public
as $$
  with authorized as (select app.assert_active_member(p_tenant_id, p_company_id, p_actor_id))
  select jsonb_build_object(
    'tenantId', p_tenant_id::text,
    'companyId', p_company_id::text,
    'nodes', coalesce(jsonb_agg(jsonb_build_object(
      'id', node.id::text,
      'name', node.name,
      'role', node.role,
      'lifecycle', node.lifecycle,
      'reportsToOrganizationNodeId', node.reports_to_node_id::text,
      'agents', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', agent.id::text,
          'name', node.name,
          'status', case when agent.state = 'suspended' then 'paused' else agent.state end,
          'charter', jsonb_build_object('id', charter.id::text, 'version', charter.version, 'mission', charter.mission),
          'authoritySummary', 'No authority grants are implied by provisioning.',
          'currentWorkSummary', 'No current work projection is available.',
          'costSummary', concat('Usage records: ', (select count(*) from public.usage_records usage where usage.tenant_id=p_tenant_id and usage.company_id=p_company_id and usage.agent_id=agent.id))
        ))
        from public.agents agent
        join public.agent_charters charter on charter.id=agent.charter_id and charter.tenant_id=agent.tenant_id and charter.company_id=agent.company_id
        where agent.tenant_id=p_tenant_id and agent.company_id=p_company_id and agent.organization_node_id=node.id
      ), '[]'::jsonb)
    ) order by node.created_at), '[]'::jsonb)
  ) from public.organization_nodes node, authorized
  where node.tenant_id=p_tenant_id and node.company_id=p_company_id;
$$;

create or replace function app.read_agent_detail(
  p_tenant_id uuid, p_company_id uuid, p_agent_id uuid, p_actor_id uuid
)
returns jsonb
language sql security definer set search_path = public
as $$
  with authorized as (select app.assert_active_member(p_tenant_id, p_company_id, p_actor_id))
  select jsonb_build_object(
    'tenantId', agent.tenant_id::text,
    'companyId', agent.company_id::text,
    'id', agent.id::text,
    'name', node.name,
    'status', case when agent.state = 'suspended' then 'paused' else agent.state end,
    'organizationNodeId', node.id::text,
    'reportingLine', coalesce(parent.name, 'No reporting line'),
    'charter', jsonb_build_object(
      'id', charter.id::text, 'version', charter.version, 'mission', charter.mission,
      'responsibilities', charter.responsibilities,
      'allowedDataCapabilities', charter.allowed_data_capabilities,
      'allowedToolCapabilities', charter.allowed_tool_capabilities
    ),
    'authoritySummary', 'No authority grants are implied by provisioning.',
    'currentWorkSummary', 'No current work projection is available.',
    'costSummary', concat('Usage records: ', (select count(*) from public.usage_records usage where usage.tenant_id=agent.tenant_id and usage.company_id=agent.company_id and usage.agent_id=agent.id)),
    'recentActivitySummary', coalesce((select max(action) from public.audit_events audit where audit.tenant_id=agent.tenant_id and audit.company_id=agent.company_id and audit.target_id=agent.id), 'No activity')
  )
  from public.agents agent
  join public.organization_nodes node on node.id=agent.organization_node_id and node.tenant_id=agent.tenant_id and node.company_id=agent.company_id
  left join public.organization_nodes parent on parent.id=node.reports_to_node_id and parent.tenant_id=node.tenant_id and parent.company_id=node.company_id
  join public.agent_charters charter on charter.id=agent.charter_id and charter.tenant_id=agent.tenant_id and charter.company_id=agent.company_id, authorized
  where agent.tenant_id=p_tenant_id and agent.company_id=p_company_id and agent.id=p_agent_id;
$$;

create or replace function app.read_company_state_cards(
  p_tenant_id uuid, p_company_id uuid, p_actor_id uuid
)
returns jsonb
language sql security definer set search_path = public
as $$
  with authorized as (select app.assert_active_member(p_tenant_id, p_company_id, p_actor_id))
  select coalesce(jsonb_agg(jsonb_build_object(
    'tenantId', metric.tenant_id::text,
    'companyId', metric.company_id::text,
    'id', metric.id::text,
    'metricKey', metric.metric_key,
    'label', metric.name,
    'displayValue', coalesce(observation.value #>> '{}', 'Unknown'),
    'source', coalesce(evidence.source, 'Unknown'),
    'observedAt', observation.observed_at,
    'freshness', case when observation.id is null then 'unknown' when observation.observed_at + make_interval(secs => observation.freshness_seconds) >= now() then 'fresh' else 'stale' end,
    'confidence', observation.confidence
  ) order by metric.created_at), '[]'::jsonb)
  from public.metrics metric
  left join lateral (
    select * from public.state_observations
    where tenant_id=metric.tenant_id and company_id=metric.company_id and metric_id=metric.id
    order by observed_at desc limit 1
  ) observation on true
  left join public.evidence evidence on evidence.id=observation.evidence_id and evidence.tenant_id=metric.tenant_id and evidence.company_id=metric.company_id, authorized
  where metric.tenant_id=p_tenant_id and metric.company_id=p_company_id;
$$;

create or replace function app.read_objectives(
  p_tenant_id uuid, p_company_id uuid, p_actor_id uuid
)
returns jsonb
language sql security definer set search_path = public
as $$
  with authorized as (select app.assert_active_member(p_tenant_id, p_company_id, p_actor_id))
  select coalesce(jsonb_agg(jsonb_build_object(
    'tenantId', objective.tenant_id::text,
    'companyId', objective.company_id::text,
    'id', objective.id::text,
    'title', objective.title,
    'description', objective.description,
    'status', case when objective.status in ('draft','active') then objective.status else 'at_risk' end,
    'ownerLabel', coalesce(node.name, 'Unassigned')
  ) order by objective.created_at desc), '[]'::jsonb)
  from public.objectives objective
  left join public.organization_nodes node on node.id=objective.owner_organization_node_id and node.tenant_id=objective.tenant_id and node.company_id=objective.company_id, authorized
  where objective.tenant_id=p_tenant_id and objective.company_id=p_company_id;
$$;

create or replace function app.read_awaiting_authority(
  p_tenant_id uuid, p_company_id uuid, p_actor_id uuid
)
returns jsonb
language sql security definer set search_path = public
as $$
  with authorized as (select app.assert_active_member(p_tenant_id, p_company_id, p_actor_id))
  select coalesce(jsonb_agg(jsonb_build_object(
    'tenantId', run.tenant_id::text,
    'companyId', run.company_id::text,
    'runId', run.id::text,
    'agentId', run.agent_id::text,
    'state', 'awaiting_authority',
    'output', run.runtime_output,
    'presentedAt', run.presented_at
  ) order by run.presented_at desc), '[]'::jsonb)
  from public.agent_runs run, authorized
  where run.tenant_id=p_tenant_id and run.company_id=p_company_id
    and run.state='awaiting_authority' and run.runtime_output is not null;
$$;

revoke all on function app.assert_active_member(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function app.read_organization_graph(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function app.read_agent_detail(uuid,uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function app.read_company_state_cards(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function app.read_objectives(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function app.read_awaiting_authority(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function app.read_organization_graph(uuid,uuid,uuid) to service_role;
grant execute on function app.read_agent_detail(uuid,uuid,uuid,uuid) to service_role;
grant execute on function app.read_company_state_cards(uuid,uuid,uuid) to service_role;
grant execute on function app.read_objectives(uuid,uuid,uuid) to service_role;
grant execute on function app.read_awaiting_authority(uuid,uuid,uuid) to service_role;
