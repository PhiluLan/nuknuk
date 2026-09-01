import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FoundationService } from "../src/index.ts";

const scope = { tenantId: "tenant_1", companyId: "company_1" };
const actor = { id: "human_1", type: "human" as const };

const transaction = (
  overrides: Partial<ConstructorParameters<typeof FoundationService>[0]> = {},
) => ({
  bootstrapFounder: async () => "tenant_1",
  createCompany: async () => "company_1",
  createMembership: async () => "membership_1",
  createOrganizationNode: async () => "node_1",
  provisionAgent: async () => "agent_1",
  ...overrides,
});
const allowMembershipRole = { canAssign: async () => true };

test("server seam validates canonical organization-node input before invoking persistence", async () => {
  let called = false;
  const service = new FoundationService(
    transaction({
      createOrganizationNode: async () => {
        called = true;
        return "node_1";
      },
    }),
    allowMembershipRole,
  );

  await assert.rejects(() =>
    service.createOrganizationNode(actor, { ...scope, role: "CTO" }),
  );
  assert.equal(called, false);
});

test("server seam provisions an application-capability agent from a charter version without authority input", async () => {
  let receivedActorId: string | undefined;
  const service = new FoundationService(
    transaction({
      provisionAgent: async (input) => {
        receivedActorId = input.actorId;
        assert.equal(input.tenantId, scope.tenantId);
        assert.equal(input.companyId, scope.companyId);
        assert.equal(input.charterVersionId, "charter_1");
        return "agent_1";
      },
    }),
    allowMembershipRole,
  );

  const agentId = await service.provisionAgent(actor, {
    ...scope,
    organizationNodeId: "node_1",
    charterVersionId: "charter_1",
  });
  assert.equal(agentId, "agent_1");
  assert.equal(receivedActorId, actor.id);
});

test("ordinary membership assignment cannot bootstrap founder or bypass server authorization", async () => {
  let called = false;
  const service = new FoundationService(
    transaction({
      createMembership: async () => {
        called = true;
        return "membership_1";
      },
    }),
    { canAssign: async () => false },
  );

  await assert.rejects(() =>
    service.createMembership(actor, {
      ...scope,
      userId: "user_2",
      role: "founder",
    }),
  );
  await assert.rejects(() =>
    service.createMembership(actor, {
      ...scope,
      userId: "user_2",
      role: "admin",
    }),
  );
  assert.equal(called, false);
});

test("founder bootstrap validates frozen tenant and company inputs", async () => {
  let receivedSlug: string | undefined;
  const service = new FoundationService(
    transaction({
      bootstrapFounder: async (input) => {
        receivedSlug = input.companySlug;
        return "tenant_1";
      },
    }),
    allowMembershipRole,
  );

  await service.bootstrapFounder(
    actor,
    { name: "Alpha", slug: "alpha" },
    {
      tenantId: scope.tenantId,
      name: "Alpha Co",
      slug: "alpha-co",
      timezone: "Europe/Zurich",
      baseCurrency: "CHF",
    },
  );
  assert.equal(receivedSlug, "alpha-co");
});

test("migration installs forced RLS, tenant-scoped composite links, immutable ledgers, and no browser writes", async () => {
  const migration = await readFile(
    new URL(
      "../../../supabase/migrations/202608300001_week_1_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const table of [
    "tenants",
    "companies",
    "memberships",
    "organization_nodes",
    "agent_charters",
    "agents",
    "audit_events",
    "domain_events",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security;`),
    );
  }
  assert.match(
    migration,
    /foreign key \(tenant_id, company_id, reports_to_node_id\) references public\.organization_nodes/,
  );
  assert.match(
    migration,
    /foreign key \(tenant_id, company_id, organization_node_id\) references public\.organization_nodes/,
  );
  assert.match(migration, /check \(identity_subject_id = id\)/);
  assert.match(migration, /identity_kind = 'application_capability'/);
  assert.match(
    migration,
    /slug text not null check \(slug ~ '\^\[a-z0-9\]\[a-z0-9-\]\{1,62\}\$'\)/,
  );
  assert.match(migration, /base_currency text not null/);
  assert.match(migration, /create or replace function app\.create_membership/);
  assert.match(migration, /founder bootstrap is a separate authorized flow/);
  assert.match(migration, /p_charter_version_id uuid/);
  assert.doesNotMatch(migration, /p_authority_level text/);
  assert.match(
    migration,
    /create trigger audit_events_immutable before update or delete/,
  );
  assert.match(
    migration,
    /create trigger domain_events_immutable before update or delete/,
  );
  assert.doesNotMatch(
    migration,
    /create policy .* for insert to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /create policy .* for update to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /create policy .* for delete to authenticated/,
  );
});
