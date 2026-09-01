-- Week 1 foundation: additive tenant-safe control-plane persistence.
-- Apply only to a clean local database or isolated Staging after review. Never Production from this worktree.

create extension if not exists pgcrypto;
create schema if not exists app;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (char_length(name) between 1 and 256),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid not null
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 256),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'suspended', 'archived')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, slug)
);
create unique index companies_one_primary_per_tenant on public.companies (tenant_id) where is_primary;
create index companies_tenant_id_idx on public.companies (tenant_id, created_at desc);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('founder', 'admin', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, company_id, user_id),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict
);
create index memberships_user_scope_idx on public.memberships (user_id, tenant_id, company_id) where status = 'active';

create table public.organization_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  role text not null check (char_length(role) between 1 and 128),
  name text not null check (char_length(name) between 1 and 256),
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'active', 'archived')),
  reports_to_node_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, company_id, id),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, company_id, reports_to_node_id) references public.organization_nodes(tenant_id, company_id, id) on delete restrict
);
create index organization_nodes_tenant_company_idx on public.organization_nodes (tenant_id, company_id, created_at desc);

create table public.agent_charters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  organization_node_id uuid not null,
  version integer not null check (version > 0),
  mission text not null check (char_length(mission) > 0),
  responsibilities jsonb not null default '[]'::jsonb,
  forbidden_actions jsonb not null default '[]'::jsonb,
  authority_level text not null check (authority_level in ('L0', 'L1', 'L2', 'L3', 'L4', 'human_only')),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, company_id, id),
  unique (tenant_id, company_id, organization_node_id, version),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, company_id, organization_node_id) references public.organization_nodes(tenant_id, company_id, id) on delete restrict
);
create index agent_charters_tenant_company_idx on public.agent_charters (tenant_id, company_id, organization_node_id, version desc);

create table public.agents (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  organization_node_id uuid not null,
  charter_id uuid not null,
  charter_version integer not null check (charter_version > 0),
  state text not null default 'draft' check (state in ('draft', 'active', 'paused', 'suspended', 'archived')),
  identity_kind text not null default 'application_capability' check (identity_kind = 'application_capability'),
  identity_subject_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  unique (tenant_id, id),
  unique (tenant_id, company_id, id),
  unique (identity_kind, identity_subject_id),
  check (identity_subject_id = id),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, company_id, organization_node_id) references public.organization_nodes(tenant_id, company_id, id) on delete restrict,
  foreign key (tenant_id, company_id, charter_id) references public.agent_charters(tenant_id, company_id, id) on delete restrict
);
create index agents_tenant_company_idx on public.agents (tenant_id, company_id, state, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  actor_type text not null check (actor_type in ('human', 'agent', 'system')),
  actor_id uuid not null,
  action text not null check (char_length(action) between 1 and 128),
  target_type text not null check (char_length(target_type) between 1 and 128),
  target_id uuid not null,
  correlation_id uuid not null,
  summary jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict
);
create index audit_events_tenant_company_idx on public.audit_events (tenant_id, company_id, occurred_at desc);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  company_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  aggregate_type text not null check (char_length(aggregate_type) between 1 and 128),
  aggregate_id uuid not null,
  actor_id uuid not null,
  correlation_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  foreign key (tenant_id, company_id) references public.companies(tenant_id, id) on delete restrict
);
create index domain_events_unpublished_idx on public.domain_events (tenant_id, occurred_at) where published_at is null;

create or replace function app.has_active_membership(p_tenant_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.company_id = p_company_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function app.prevent_immutable_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'immutable ledger rows cannot be updated or deleted';
end;
$$;

create trigger audit_events_immutable before update or delete on public.audit_events for each row execute function app.prevent_immutable_mutation();
create trigger domain_events_immutable before update or delete on public.domain_events for each row execute function app.prevent_immutable_mutation();

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.organization_nodes enable row level security;
alter table public.organization_nodes force row level security;
alter table public.agent_charters enable row level security;
alter table public.agent_charters force row level security;
alter table public.agents enable row level security;
alter table public.agents force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.domain_events enable row level security;
alter table public.domain_events force row level security;

create policy tenants_select_member on public.tenants for select to authenticated using (
  exists (select 1 from public.memberships membership where membership.tenant_id = tenants.id and membership.user_id = auth.uid() and membership.status = 'active')
);
create policy companies_select_member on public.companies for select to authenticated using (app.has_active_membership(tenant_id, id));
create policy memberships_select_self on public.memberships for select to authenticated using (user_id = auth.uid() and status = 'active');
create policy organization_nodes_select_member on public.organization_nodes for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy agent_charters_select_member on public.agent_charters for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy agents_select_member on public.agents for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy audit_events_select_member on public.audit_events for select to authenticated using (app.has_active_membership(tenant_id, company_id));
create policy domain_events_select_member on public.domain_events for select to authenticated using (app.has_active_membership(tenant_id, company_id));

create or replace function app.assert_active_operator(p_tenant_id uuid, p_company_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.company_id = p_company_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('founder', 'admin', 'operator')
  ) then
    raise exception 'active operator membership required';
  end if;
end;
$$;

create or replace function app.create_tenant_with_founder(
  p_slug text, p_tenant_name text, p_company_name text, p_company_slug text, p_founder_user_id uuid, p_timezone text default 'UTC', p_base_currency text default 'USD', p_correlation_id uuid default gen_random_uuid()
)
returns table (tenant_id uuid, company_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := gen_random_uuid();
  v_company_id uuid := gen_random_uuid();
  v_membership_id uuid := gen_random_uuid();
begin
  insert into public.tenants (id, slug, name, created_by) values (v_tenant_id, p_slug, p_tenant_name, p_founder_user_id);
  insert into public.companies (id, tenant_id, name, slug, timezone, base_currency, is_primary, created_by) values (v_company_id, v_tenant_id, p_company_name, p_company_slug, p_timezone, p_base_currency, true, p_founder_user_id);
  insert into public.memberships (id, tenant_id, company_id, user_id, role, created_by) values (v_membership_id, v_tenant_id, v_company_id, p_founder_user_id, 'founder', p_founder_user_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary) values
    (v_tenant_id, v_company_id, 'human', p_founder_user_id, 'tenant.created', 'tenant', v_tenant_id, p_correlation_id, jsonb_build_object('company_id', v_company_id));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload) values
    (v_tenant_id, v_company_id, 'tenant.created', 'tenant', v_tenant_id, p_founder_user_id, p_correlation_id, jsonb_build_object('company_id', v_company_id));
  return query select v_tenant_id, v_company_id, v_membership_id;
end;
$$;

create or replace function app.create_company(
  p_tenant_id uuid, p_name text, p_slug text, p_timezone text, p_base_currency text, p_actor_id uuid, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_company_id uuid := gen_random_uuid();
begin
  if not exists (
    select 1 from public.memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('founder', 'admin', 'operator')
  ) then
    raise exception 'active tenant operator membership required';
  end if;
  insert into public.companies (id, tenant_id, name, slug, timezone, base_currency, is_primary, created_by)
  values (v_company_id, p_tenant_id, p_name, p_slug, p_timezone, p_base_currency, false, p_actor_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary) values
    (p_tenant_id, v_company_id, 'human', p_actor_id, 'company.created', 'company', v_company_id, p_correlation_id, jsonb_build_object('slug', p_slug));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload) values
    (p_tenant_id, v_company_id, 'company.created', 'company', v_company_id, p_actor_id, p_correlation_id, jsonb_build_object('slug', p_slug));
  return v_company_id;
end;
$$;

create or replace function app.create_membership(
  p_tenant_id uuid, p_company_id uuid, p_user_id uuid, p_role text, p_actor_id uuid, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_membership_id uuid := gen_random_uuid();
begin
  if p_role = 'founder' then
    raise exception 'founder bootstrap is a separate authorized flow';
  end if;
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  insert into public.memberships (id, tenant_id, company_id, user_id, role, created_by)
  values (v_membership_id, p_tenant_id, p_company_id, p_user_id, p_role, p_actor_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary) values
    (p_tenant_id, p_company_id, 'human', p_actor_id, 'membership.created', 'membership', v_membership_id, p_correlation_id, jsonb_build_object('role', p_role, 'user_id', p_user_id));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload) values
    (p_tenant_id, p_company_id, 'membership.created', 'membership', v_membership_id, p_actor_id, p_correlation_id, jsonb_build_object('role', p_role));
  return v_membership_id;
end;
$$;

create or replace function app.create_organization_node(
  p_tenant_id uuid, p_company_id uuid, p_role text, p_name text, p_lifecycle text, p_reports_to_node_id uuid, p_actor_id uuid, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_node_id uuid := gen_random_uuid();
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  insert into public.organization_nodes (id, tenant_id, company_id, role, name, lifecycle, reports_to_node_id, created_by)
  values (v_node_id, p_tenant_id, p_company_id, p_role, p_name, p_lifecycle, p_reports_to_node_id, p_actor_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary) values
    (p_tenant_id, p_company_id, 'human', p_actor_id, 'organization_node.created', 'organization_node', v_node_id, p_correlation_id, jsonb_build_object('role', p_role));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload) values
    (p_tenant_id, p_company_id, 'organization_node.created', 'organization_node', v_node_id, p_actor_id, p_correlation_id, jsonb_build_object('role', p_role));
  return v_node_id;
end;
$$;

create or replace function app.provision_agent(
  p_tenant_id uuid, p_company_id uuid, p_organization_node_id uuid, p_charter_version_id uuid, p_actor_id uuid, p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid := gen_random_uuid();
  v_charter_version integer;
begin
  perform app.assert_active_operator(p_tenant_id, p_company_id, p_actor_id);
  select charter.version into v_charter_version
  from public.agent_charters charter
  where charter.id = p_charter_version_id
    and charter.tenant_id = p_tenant_id
    and charter.company_id = p_company_id
    and charter.organization_node_id = p_organization_node_id;
  if v_charter_version is null then
    raise exception 'charter version is outside the requested tenant/company/node scope';
  end if;
  insert into public.agents (id, tenant_id, company_id, organization_node_id, charter_id, charter_version, identity_subject_id, created_by)
  values (v_agent_id, p_tenant_id, p_company_id, p_organization_node_id, p_charter_version_id, v_charter_version, v_agent_id, p_actor_id);
  insert into public.audit_events (tenant_id, company_id, actor_type, actor_id, action, target_type, target_id, correlation_id, summary) values
    (p_tenant_id, p_company_id, 'human', p_actor_id, 'agent.provisioned', 'agent', v_agent_id, p_correlation_id, jsonb_build_object('charter_version_id', p_charter_version_id));
  insert into public.domain_events (tenant_id, company_id, event_type, aggregate_type, aggregate_id, actor_id, correlation_id, payload) values
    (p_tenant_id, p_company_id, 'agent.provisioned', 'agent', v_agent_id, p_actor_id, p_correlation_id, jsonb_build_object('charter_version_id', p_charter_version_id));
  return v_agent_id;
end;
$$;

revoke all on schema app from public, anon, authenticated;
revoke all on function app.has_active_membership(uuid, uuid) from public;
revoke all on function app.assert_active_operator(uuid, uuid, uuid) from public;
revoke all on function app.create_tenant_with_founder(text, text, text, text, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function app.create_company(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function app.create_membership(uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function app.create_organization_node(uuid, uuid, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function app.provision_agent(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant usage on schema app to service_role;
grant usage on schema app to authenticated;
grant execute on function app.has_active_membership(uuid, uuid) to authenticated;
grant execute on function app.create_tenant_with_founder(text, text, text, text, uuid, text, text, uuid) to service_role;
grant execute on function app.create_company(uuid, text, text, text, text, uuid, uuid) to service_role;
grant execute on function app.create_membership(uuid, uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function app.create_organization_node(uuid, uuid, text, text, text, uuid, uuid, uuid) to service_role;
grant execute on function app.provision_agent(uuid, uuid, uuid, uuid, uuid, uuid) to service_role;
