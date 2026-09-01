# Week 1 Foundation: schema and RLS plan

## Status

Proposed for CTO review. This plan is additive and targets an empty environment only. It must be validated locally or against the isolated Staging project before any reviewed Production plan; it must never be applied to Production from this worktree.

## Contract check

CTO Decision 001 freezes the canonical transport inputs `CreateTenant`, `CreateCompany`, `CreateMembership`, and `ProvisionAgent`. They expose only client-owned input; IDs, lifecycle, agent identity, authority, credentials, and audit metadata remain server-owned. See [CTO Decision Request 001](../cto-decision-requests/001-week-1-foundation-transport-contracts.md).

The database and server seam use the frozen creation inputs plus the existing `organizationNodeSchema` and `agentCharterSchema`. No runtime behavior, UI endpoint, or domain vocabulary changes are included.

## Additive schema

The first migration adds `public.tenants`, `companies`, `memberships`, `organization_nodes`, `agent_charters`, `agents`, `audit_events`, and `domain_events`.

- All tenant-owned records have non-null `tenant_id`; principal indexes start with it.
- Each tenant-owned table has `unique (tenant_id, id)` so foreign keys can bind scope and identity together.
- Company-scoped links use `(tenant_id, company_id, id)` constraints. An organization node cannot report across companies, an agent cannot attach to a node or charter outside its tenant/company, and a charter cannot attach to a node outside its tenant/company.
- Agent identity is generated as an immutable application-capability subject equal to the agent ID. It has no `auth.users` identity, shared human account, or service-role identity.
- Audit and domain-event rows are append-only and include tenant, company, actor, target, correlation ID, and non-secret JSON payload/summary.

## Access and mutation model

RLS is enabled and forced on every tenant-owned table. There are no direct `INSERT`, `UPDATE`, or `DELETE` policies for browser identities. Read policies resolve an active membership with `auth.uid()` and an exact tenant/company match; membership rows are readable only by their own human user.

`app.create_tenant_with_founder`, `app.create_organization_node`, and `app.provision_agent` are the temporary server-side persistence seam. They are executable only by `service_role`; an application service must derive and supply the human actor ID from verified server-side identity. Each function checks active membership where applicable and writes its audit and domain events before returning. This does not make `service_role` an agent identity.

## Validation plan

1. Apply the migration to an empty local Supabase/Postgres database.
2. Create two synthetic Auth users and two foundations through the server-only functions.
3. With each user's JWT, attempt direct PostgREST reads, inserts, updates, deletes, and cross-tenant foreign-key links. Each attempt must fail or return no rows.
4. Confirm successful organization and agent mutations each have matching audit and domain events under the same transaction.
5. Run the same suite against Staging only when its credentials are already available in the protected work environment.

The repository includes static migration checks. Database integration validation is deliberately run only against a local disposable database or an already-configured protected Staging environment; no staging or production credentials are requested or embedded.
