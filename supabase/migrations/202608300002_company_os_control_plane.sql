-- Additive Company-OS Control Plane foundation. Apply only to clean local or reviewed Staging.

create table public.agent_runs (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  agent_id uuid not null, state text not null check (state in ('queued','assembling_context','running','awaiting_authority','completed','failed','cancelled','timed_out','blocked')),
  trigger_ref text not null, idempotency_key text not null, failure_reason text, output_pointer text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id, agent_id) references public.agents(tenant_id, company_id, id)
);
create index agent_runs_scope_idx on public.agent_runs (tenant_id, company_id, agent_id, created_at desc);

create table public.idempotency_reservations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  operation text not null, idempotency_key text not null, run_id uuid not null, reserved_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, company_id, operation, idempotency_key),
  foreign key (tenant_id, company_id, run_id) references public.agent_runs(tenant_id, company_id, id)
);

create table public.run_context_manifests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  run_id uuid not null, manifest_pointer text not null, manifest_hash text not null, evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, run_id),
  foreign key (tenant_id, company_id, run_id) references public.agent_runs(tenant_id, company_id, id)
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  agent_id uuid not null, run_id uuid, provider text not null, model text not null, input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0), estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  occurred_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id, agent_id) references public.agents(tenant_id, company_id, id),
  foreign key (tenant_id, company_id, run_id) references public.agent_runs(tenant_id, company_id, id)
);
create index usage_records_scope_idx on public.usage_records (tenant_id, company_id, agent_id, occurred_at desc);

create table public.evidence (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  evidence_type text not null check (evidence_type in ('verified_system_data','human_input','external_source','agent_inference','insufficient_evidence')),
  runtime_classification text check (runtime_classification in ('verified_fact','human_input','external_information','agent_inference','insufficient_evidence')),
  source text not null, content_pointer text not null, content_hash text, collected_at timestamptz not null, freshness_seconds integer not null default 0 check (freshness_seconds >= 0),
  confidence numeric(4,3) not null check (confidence between 0 and 1), classification text not null default 'internal' check (classification in ('public','internal','confidential','restricted')),
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id)
);

create table public.metrics (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_]{1,62}$'), name text not null, unit text not null,
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), unique (tenant_id, company_id, metric_key),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id)
);

create table public.state_observations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  metric_id uuid not null, value jsonb not null, evidence_id uuid, observed_at timestamptz not null, ingested_at timestamptz not null,
  freshness_seconds integer not null check (freshness_seconds >= 0), confidence numeric(4,3) not null check (confidence between 0 and 1),
  owner_id uuid not null, created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id, metric_id) references public.metrics(tenant_id, company_id, id),
  foreign key (tenant_id, company_id, evidence_id) references public.evidence(tenant_id, company_id, id)
);
create index state_observations_scope_idx on public.state_observations (tenant_id, company_id, metric_id, observed_at desc);

create table public.objectives (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  owner_type text not null check (owner_type in ('human','agent')), owner_id uuid not null, status text not null default 'draft' check (status in ('draft','active','paused','completed','cancelled')),
  title text not null, target_date date, success_measure_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), foreign key (tenant_id, company_id) references public.companies(tenant_id, id)
);

create table public.authority_grants (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  subject_type text not null check (subject_type in ('human','agent')), subject_id uuid not null, action_class text not null, resource_scope text not null,
  level text not null check (level in ('L0','L1','L2','L3','L4','human_only')), requires_approval boolean not null default false, expires_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), foreign key (tenant_id, company_id) references public.companies(tenant_id, id),
  check (subject_id <> created_by)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  agent_run_id uuid, content_pointer text not null, created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id, agent_run_id) references public.agent_runs(tenant_id, company_id, id)
);
create table public.authority_evaluations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  proposal_id uuid not null, outcome text not null check (outcome in ('allow','require_approval','deny')), rule_refs jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(), evaluated_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), foreign key (tenant_id, company_id, proposal_id) references public.proposals(tenant_id, company_id, id)
);
create table public.decisions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  proposal_id uuid, status text not null default 'draft' check (status in ('draft','proposed','challenged','approved','rejected','executed','measured','learned','expired')),
  created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), foreign key (tenant_id, company_id, proposal_id) references public.proposals(tenant_id, company_id, id)
);
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  decision_id uuid not null, status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  snapshot_pointer text not null, created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id), foreign key (tenant_id, company_id, decision_id) references public.decisions(tenant_id, company_id, id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), company_id uuid not null,
  decision_id uuid, proposal_id uuid, owner_type text check (owner_type in ('human','agent')), owner_id uuid, status text not null default 'backlog' check (status in ('backlog','ready','in_progress','blocked','done','cancelled')),
  title text not null, created_at timestamptz not null default now(), created_by uuid not null,
  unique (tenant_id, id), unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id, decision_id) references public.decisions(tenant_id, company_id, id),
  foreign key (tenant_id, company_id, proposal_id) references public.proposals(tenant_id, company_id, id)
);

create or replace function app.prevent_control_plane_delete() returns trigger language plpgsql security invoker set search_path = public as $$ begin raise exception 'control-plane ledger rows cannot be deleted'; end; $$;
create trigger usage_records_immutable before update or delete on public.usage_records for each row execute function app.prevent_immutable_mutation();
create trigger idempotency_reservations_immutable before update or delete on public.idempotency_reservations for each row execute function app.prevent_immutable_mutation();
create trigger authority_evaluations_immutable before update or delete on public.authority_evaluations for each row execute function app.prevent_immutable_mutation();
create trigger run_context_manifests_no_delete before delete on public.run_context_manifests for each row execute function app.prevent_control_plane_delete();

alter table public.agent_runs enable row level security; alter table public.agent_runs force row level security;
alter table public.idempotency_reservations enable row level security; alter table public.idempotency_reservations force row level security;
alter table public.run_context_manifests enable row level security; alter table public.run_context_manifests force row level security;
alter table public.usage_records enable row level security; alter table public.usage_records force row level security;
alter table public.evidence enable row level security; alter table public.evidence force row level security;
alter table public.metrics enable row level security; alter table public.metrics force row level security;
alter table public.state_observations enable row level security; alter table public.state_observations force row level security;
alter table public.objectives enable row level security; alter table public.objectives force row level security;
alter table public.authority_grants enable row level security; alter table public.authority_grants force row level security;
alter table public.proposals enable row level security; alter table public.proposals force row level security;
alter table public.authority_evaluations enable row level security; alter table public.authority_evaluations force row level security;
alter table public.decisions enable row level security; alter table public.decisions force row level security;
alter table public.approval_requests enable row level security; alter table public.approval_requests force row level security;
alter table public.tasks enable row level security; alter table public.tasks force row level security;

create policy agent_runs_select_member on public.agent_runs for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy context_manifests_select_member on public.run_context_manifests for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy usage_select_member on public.usage_records for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy evidence_select_member on public.evidence for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy metrics_select_member on public.metrics for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy observations_select_member on public.state_observations for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy objectives_select_member on public.objectives for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy grants_select_member on public.authority_grants for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy proposals_select_member on public.proposals for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy evaluations_select_member on public.authority_evaluations for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy decisions_select_member on public.decisions for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy approvals_select_member on public.approval_requests for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy tasks_select_member on public.tasks for select to authenticated using (app.has_active_membership(tenant_id, company_id));

create or replace function app.reserve_agent_run(p_tenant_id uuid, p_company_id uuid, p_agent_id uuid, p_run_id uuid, p_idempotency_key text, p_trigger_ref text, p_actor_id uuid)
returns table (accepted boolean, existing_run_id uuid) language plpgsql security definer set search_path = public as $$
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  if not exists (select 1 from public.agents where id = p_agent_id and tenant_id = p_tenant_id and company_id = p_company_id) then raise exception 'agent scope mismatch'; end if;
  select run_id into existing_run_id from public.idempotency_reservations where tenant_id=p_tenant_id and company_id=p_company_id and operation='agent_run' and idempotency_key=p_idempotency_key;
  if existing_run_id is not null then accepted := false; return next; return; end if;
  insert into public.agent_runs (id,tenant_id,company_id,agent_id,state,trigger_ref,idempotency_key,created_by) values (p_run_id,p_tenant_id,p_company_id,p_agent_id,'queued',p_trigger_ref,p_idempotency_key,p_actor_id);
  insert into public.idempotency_reservations (tenant_id,company_id,operation,idempotency_key,run_id) values (p_tenant_id,p_company_id,'agent_run',p_idempotency_key,p_run_id);
  insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'human',p_actor_id,'agent_run.queued','agent_run',p_run_id,gen_random_uuid());
  insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'agent_run.queued','agent_run',p_run_id,p_actor_id,gen_random_uuid());
  accepted := true; existing_run_id := p_run_id; return next;
end; $$;

create or replace function app.persist_agent_run_transition(p_tenant_id uuid, p_company_id uuid, p_agent_id uuid, p_run_id uuid, p_next_state text, p_failure_reason text, p_output_pointer text, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_current text;
begin
 select state into v_current from public.agent_runs where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id and agent_id=p_agent_id for update;
 if v_current is null then raise exception 'agent run scope mismatch'; end if;
 if not ((v_current='queued' and p_next_state in ('assembling_context','cancelled','blocked')) or (v_current='assembling_context' and p_next_state in ('running','cancelled','failed','blocked')) or (v_current='running' and p_next_state in ('awaiting_authority','completed','failed','cancelled','timed_out','blocked')) or (v_current='awaiting_authority' and p_next_state in ('completed','failed','cancelled','blocked'))) then raise exception 'invalid agent run transition'; end if;
 update public.agent_runs set state=p_next_state,failure_reason=p_failure_reason,output_pointer=p_output_pointer,updated_at=now() where id=p_run_id and tenant_id=p_tenant_id and company_id=p_company_id;
 insert into public.audit_events (tenant_id,company_id,actor_type,actor_id,action,target_type,target_id,correlation_id) values (p_tenant_id,p_company_id,'system',p_actor_id,'agent_run.transitioned','agent_run',p_run_id,gen_random_uuid());
 insert into public.domain_events (tenant_id,company_id,event_type,aggregate_type,aggregate_id,actor_id,correlation_id) values (p_tenant_id,p_company_id,'agent_run.transitioned','agent_run',p_run_id,p_actor_id,gen_random_uuid());
end; $$;

revoke all on function app.reserve_agent_run(uuid,uuid,uuid,uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function app.persist_agent_run_transition(uuid,uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function app.reserve_agent_run(uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
grant execute on function app.persist_agent_run_transition(uuid,uuid,uuid,uuid,text,text,text,uuid) to service_role;
