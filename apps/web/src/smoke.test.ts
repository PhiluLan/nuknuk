import assert from "node:assert/strict";
import test from "node:test";
import {
  agentDetailViewSchema,
  awaitingAuthorityViewSchema,
  companyStateCardViewSchema,
  integrationConnectionViewSchema,
  objectiveViewSchema,
  organizationGraphViewSchema,
} from "@nuknuk/api-contracts";
import {
  ApiProductService,
  FixtureProductService,
  ProductApiError,
  renderProduct,
  renderProposal,
  renderShell,
  type RuntimeProposalView,
} from "./index.ts";

test("frozen Decision-001 fixture supports bootstrap and ProvisionAgent", async () => {
  const service = new FixtureProductService();
  await service.bootstrapFounder({
    tenant: { name: "Example Tenant", slug: "example-tenant" },
    company: {
      name: "Example Co",
      slug: "example-co",
      timezone: "Europe/Zurich",
      baseCurrency: "CHF",
    },
  });
  const snapshot = await service.getSnapshot();
  await service.provisionAgent({
    tenantId: snapshot.tenantId,
    companyId: snapshot.company.id,
    organizationNodeId: snapshot.organizationNodes[0]!.id,
    charterVersionId: snapshot.agents[0]!.charter.versionId,
  });
  assert.match(
    renderProduct("/organization", await service.getSnapshot()),
    /Draft agent 2/,
  );
});

test("proposal rendering keeps facts, recommendations, tasks, and actions visibly non-executing", async () => {
  const snapshot = await new FixtureProductService().getSnapshot();
  const proposal: RuntimeProposalView = snapshot.founderAttention[0]!;
  const view = renderProposal(proposal);
  assert.match(view, /Verified fact/);
  assert.match(view, /Recommendation — not a Decision/);
  assert.match(view, /Proposed tasks — not created work/);
  assert.match(view, /Proposed actions — not executed Actions/);
});

test("company state distinguishes stale and unknown values", async () => {
  const view = renderProduct(
    "/company-state",
    await new FixtureProductService().getSnapshot(),
  );
  assert.match(view, /card--stale/);
  assert.match(view, /card--unknown/);
  assert.match(view, /percent/);
});

test("integration presentation shows descriptive provider and an absent sync without credential data", async () => {
  const view = renderProduct(
    "/integrations",
    await new FixtureProductService().getSnapshot(),
  );
  assert.match(view, /Provider: Example provider/);
  assert.match(view, /Last sync: No known sync/);
  assert.doesNotMatch(
    view,
    /secret_[a-z0-9]+|token_[a-z0-9]+|credential_[a-z0-9]+/i,
  );
});

test("fixture ProductService implements the approved Decision-003 view boundary", async () => {
  const service = new FixtureProductService();
  const snapshot = await service.getSnapshot();
  const scope = { tenantId: snapshot.tenantId, companyId: snapshot.company.id };
  assert.equal(
    organizationGraphViewSchema.safeParse(
      await service.getOrganizationGraph(scope),
    ).success,
    true,
  );
  assert.equal(
    agentDetailViewSchema.safeParse(
      await service.getAgentDetail({
        ...scope,
        agentId: snapshot.agents[0]!.id,
      }),
    ).success,
    true,
  );
  assert.equal(
    (await service.getCompanyStateCards(scope)).every(
      (view) => companyStateCardViewSchema.safeParse(view).success,
    ),
    true,
  );
  assert.equal(
    (await service.listObjectives(scope)).every(
      (view) => objectiveViewSchema.safeParse(view).success,
    ),
    true,
  );
  assert.equal(
    (await service.listAwaitingAuthority(scope)).every(
      (view) => awaitingAuthorityViewSchema.safeParse(view).success,
    ),
    true,
  );
  assert.equal(
    (await service.listIntegrationConnections(scope)).every(
      (view) => integrationConnectionViewSchema.safeParse(view).success,
    ),
    true,
  );
});

test("API ProductService parses server views and sends only scoped approved mutations", async () => {
  const fixture = new FixtureProductService();
  const snapshot = await fixture.getSnapshot();
  const scope = { tenantId: snapshot.tenantId, companyId: snapshot.company.id };
  const posted: unknown[] = [];
  const service = new ApiProductService(
    {
      get: async (path) => {
        if (path === "/organization")
          return fixture.getOrganizationGraph(scope);
        if (path === "/company-state")
          return fixture.getCompanyStateCards(scope);
        if (path === "/objectives") return fixture.listObjectives(scope);
        if (path === "/attention") return fixture.listAwaitingAuthority(scope);
        if (path === "/integrations")
          return fixture.listIntegrationConnections(scope);
        return fixture.getAgentDetail({
          ...scope,
          agentId: path.slice("/agents/".length),
        });
      },
      post: async (_path, body) => {
        posted.push(body);
        return {};
      },
    },
    {
      bootstrapFounder: "/bootstrap",
      memberships: "/memberships",
      organizationGraph: "/organization",
      organizationNodes: "/organization/nodes",
      agentCharterVersions: "/charters",
      agents: "/agents",
      agentDetail: (agentId) => `/agents/${agentId}`,
      companyStateCards: "/company-state",
      objectives: "/objectives",
      awaitingAuthority: "/attention",
      integrations: "/integrations",
    },
    { tenantId: scope.tenantId, company: snapshot.company },
  );
  assert.equal(
    (await service.getSnapshot()).agents.length,
    snapshot.agents.length,
  );
  await service.createObjective({
    ...scope,
    title: "Review activation",
    description: "Create a scoped review",
  });
  assert.deepEqual(posted[0], {
    ...scope,
    title: "Review activation",
    description: "Create a scoped review",
  });
});

test("API ProductService rejects a syntactically valid cross-tenant projection", async () => {
  const fixture = new FixtureProductService();
  const snapshot = await fixture.getSnapshot();
  const scope = { tenantId: snapshot.tenantId, companyId: snapshot.company.id };
  const service = new ApiProductService(
    {
      get: async () => ({
        ...(await fixture.getOrganizationGraph(scope)),
        tenantId: "tenant_other",
      }),
      post: async () => ({}),
    },
    {
      bootstrapFounder: "/bootstrap",
      memberships: "/memberships",
      organizationGraph: "/organization",
      organizationNodes: "/organization/nodes",
      agentCharterVersions: "/charters",
      agents: "/agents",
      agentDetail: (agentId) => `/agents/${agentId}`,
      companyStateCards: "/company-state",
      objectives: "/objectives",
      awaitingAuthority: "/attention",
      integrations: "/integrations",
    },
    { tenantId: scope.tenantId, company: snapshot.company },
  );
  await assert.rejects(
    () => service.getOrganizationGraph(scope),
    ProductApiError,
  );
});

test("API error status remains distinguishable for route-level unauthorized handling", () => {
  const error = new ProductApiError("Forbidden", 403);
  assert.equal(error.status, 403);
});

test("shell exposes explicit unavailable states", () => {
  assert.match(
    renderShell("/organization", "", "unauthorized"),
    /do not have access/i,
  );
  assert.match(renderShell("/organization", "", "error"), /could not load/i);
});
