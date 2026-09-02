import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompanySchema,
  createAgentCharterVersionSchema,
  createMembershipSchema,
  createObjectiveSchema,
  createOrganizationNodeSchema,
  createTenantSchema,
  agentRuntimeOutputSchema,
  agentDetailViewSchema,
  awaitingAuthorityViewSchema,
  companyStateCardViewSchema,
  integrationConnectionViewSchema,
  objectiveViewSchema,
  organizationGraphViewSchema,
  provisionAgentSchema,
  stateObservationSchema,
} from "../src/index.ts";

const scope = { tenantId: "tenant_1", companyId: "company_1" };

test("state observation requires tenant and company scope", () => {
  const parsed = stateObservationSchema.safeParse({
    ...scope,
    metricKey: "weekly_deciding_users",
    value: 12,
    unit: "users",
    observedAt: "2026-08-30T10:00:00.000Z",
    ingestedAt: "2026-08-30T10:00:01.000Z",
    freshnessSeconds: 3600,
    confidence: 0.9,
  });
  assert.equal(parsed.success, true);
});

test("state observation rejects an unscoped metric", () => {
  const parsed = stateObservationSchema.safeParse({
    metricKey: "weekly_deciding_users",
    value: 12,
    unit: "users",
    observedAt: "2026-08-30T10:00:00.000Z",
    ingestedAt: "2026-08-30T10:00:01.000Z",
    freshnessSeconds: 3600,
    confidence: 0.9,
  });
  assert.equal(parsed.success, false);
});

test("Decision 001 transport inputs accept only client-owned fields", () => {
  assert.equal(
    createTenantSchema.safeParse({ name: "Alpha", slug: "alpha" }).success,
    true,
  );
  assert.equal(
    createCompanySchema.safeParse({
      tenantId: scope.tenantId,
      name: "Alpha Co",
      slug: "alpha-co",
      timezone: "Europe/Zurich",
      baseCurrency: "CHF",
    }).success,
    true,
  );
  assert.equal(
    createMembershipSchema.safeParse({
      ...scope,
      userId: "user_1",
      role: "operator",
    }).success,
    true,
  );
  assert.equal(
    provisionAgentSchema.safeParse({
      ...scope,
      organizationNodeId: "node_1",
      charterVersionId: "charter_1",
    }).success,
    true,
  );
});

test("Decision 001 transport inputs reject persistence, identity, and authority fields", () => {
  assert.equal(
    createTenantSchema.safeParse({
      name: "Alpha",
      slug: "alpha",
      lifecycle: "active",
    }).success,
    false,
  );
  assert.equal(
    createCompanySchema.safeParse({
      tenantId: scope.tenantId,
      name: "Alpha Co",
      slug: "alpha-co",
      timezone: "UTC",
      baseCurrency: "USD",
      id: "company_1",
    }).success,
    false,
  );
  assert.equal(
    provisionAgentSchema.safeParse({
      ...scope,
      organizationNodeId: "node_1",
      charterVersionId: "charter_1",
      identityType: "service_role",
    }).success,
    false,
  );
  assert.equal(
    provisionAgentSchema.safeParse({
      ...scope,
      organizationNodeId: "node_1",
      charterVersionId: "charter_1",
      authorityLevel: "L4",
    }).success,
    false,
  );
});

const runtimeOutput = {
  run_id: "run_1",
  tenant_id: "tenant_1",
  company_id: "company_1",
  agent_id: "agent_1",
  summary: "A scoped proposal",
  claims: [
    {
      statement: "Observed signal",
      classification: "verified_fact",
      evidence_refs: ["evidence_1"],
      confidence: 0.9,
    },
  ],
  recommendations: [{ summary: "Review the signal" }],
  proposed_tasks: [{ title: "Investigate signal" }],
  proposed_actions: [{ intent: "Request human review" }],
  uncertainty: [{ type: "low_confidence" }],
  overall_confidence: 0.8,
  generated_at: "2026-08-30T10:00:00.000Z",
};

test("Decision 002 rejects a verified fact without evidence", () => {
  const parsed = agentRuntimeOutputSchema.safeParse({
    ...runtimeOutput,
    claims: [{ ...runtimeOutput.claims[0], evidence_refs: [] }],
  });
  assert.equal(parsed.success, false);
});

test("Decision 002 rejects malformed confidence and execution-shaped fields", () => {
  assert.equal(
    agentRuntimeOutputSchema.safeParse({
      ...runtimeOutput,
      overall_confidence: 1.1,
    }).success,
    false,
  );
  for (const field of [
    "authorization",
    "approval",
    "credentials",
    "secret",
    "execution_token",
    "service_role",
    "budget_override",
    "policy_override",
  ]) {
    assert.equal(
      agentRuntimeOutputSchema.safeParse({
        ...runtimeOutput,
        proposed_actions: [{ intent: "Dispatch", [field]: "forbidden" }],
      }).success,
      false,
      field,
    );
  }
  assert.equal(
    agentRuntimeOutputSchema.safeParse({
      ...runtimeOutput,
      proposed_tasks: [{ title: "Persist me", id: "task_1" }],
    }).success,
    false,
  );
});

test("Decision 003 product projections accept scoped, denormalized business views", () => {
  assert.equal(
    organizationGraphViewSchema.safeParse({
      ...scope,
      nodes: [
        {
          id: "node_1",
          name: "Operations",
          role: "Operations",
          lifecycle: "active",
          agents: [
            {
              id: "agent_1",
              name: "Analyst",
              status: "active",
              charter: {
                id: "charter_1",
                version: 1,
                mission: "Synthesize state",
              },
              authoritySummary: "Descriptive only",
              currentWorkSummary: "No work",
              costSummary: "Unavailable",
            },
          ],
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    agentDetailViewSchema.safeParse({
      ...scope,
      id: "agent_1",
      name: "Analyst",
      status: "awaiting_authority",
      organizationNodeId: "node_1",
      reportingLine: "Operations",
      charter: {
        id: "charter_1",
        version: 1,
        mission: "Synthesize state",
        responsibilities: ["Review state"],
        allowedDataCapabilities: ["Read scoped state"],
        allowedToolCapabilities: ["None until authorized"],
      },
      authoritySummary: "Descriptive only",
      currentWorkSummary: "Proposal awaiting authority",
      costSummary: "Unavailable",
      recentActivitySummary: "Generated a proposal",
    }).success,
    true,
  );
  assert.equal(
    companyStateCardViewSchema.safeParse({
      ...scope,
      id: "state_1",
      metricKey: "weekly_activation",
      label: "Weekly activation",
      displayValue: "42%",
      unit: "percent",
      source: "Verified system data",
      freshness: "unknown",
      confidence: null,
    }).success,
    true,
  );
  assert.equal(
    objectiveViewSchema.safeParse({
      ...scope,
      id: "objective_1",
      title: "Understand activation",
      description: "Build a cohort view",
      status: "active",
      ownerLabel: "Operations",
    }).success,
    true,
  );
  assert.equal(
    integrationConnectionViewSchema.safeParse({
      ...scope,
      id: "integration_1",
      name: "Example",
      provider: "Example provider",
      capabilities: ["Read account status"],
      scopeSummary: "Selected workspace",
      health: "not_configured",
      lastSyncAt: null,
      connectionFlow: "server_initiated",
    }).success,
    true,
  );
});

test("Decision 003 mutations accept business input without implicit authority", () => {
  assert.equal(
    createOrganizationNodeSchema.safeParse({
      ...scope,
      name: "Operations",
      role: "Operations",
      reportsToOrganizationNodeId: "node_founder",
    }).success,
    true,
  );
  assert.equal(
    createAgentCharterVersionSchema.safeParse({
      ...scope,
      organizationNodeId: "node_1",
      mission: "Synthesize state",
      responsibilities: ["Review state"],
      allowedDataCapabilities: ["Read scoped state"],
      allowedToolCapabilities: ["None until authorized"],
    }).success,
    true,
  );
  assert.equal(
    createObjectiveSchema.safeParse({
      ...scope,
      title: "Understand activation",
      description: "Build a cohort view",
      ownerOrganizationNodeId: "node_1",
    }).success,
    true,
  );
});

test("Decision 003 rejects unscoped, authority, credential, and execution-shaped views", () => {
  assert.equal(
    createOrganizationNodeSchema.safeParse({
      name: "Operations",
      role: "Operations",
    }).success,
    false,
  );
  for (const field of [
    "authorityOutcome",
    "approval",
    "service_role",
    "credential",
    "executionEnvelope",
  ]) {
    assert.equal(
      createAgentCharterVersionSchema.safeParse({
        ...scope,
        organizationNodeId: "node_1",
        mission: "Synthesize state",
        responsibilities: [],
        allowedDataCapabilities: [],
        allowedToolCapabilities: [],
        [field]: "forbidden",
      }).success,
      false,
      field,
    );
  }
  assert.equal(
    integrationConnectionViewSchema.safeParse({
      ...scope,
      id: "integration_1",
      name: "Example",
      provider: "Example provider",
      capabilities: ["Read"],
      scopeSummary: "Workspace",
      health: "active",
      lastSyncAt: "2026-09-02T10:00:00.000Z",
      connectionFlow: "server_initiated",
      token: "forbidden",
    }).success,
    false,
  );
});

test("Decision 004 requires a separate unit and safely permits an absent sync timestamp", () => {
  assert.equal(
    companyStateCardViewSchema.safeParse({
      ...scope,
      id: "state_1",
      metricKey: "weekly_activation",
      label: "Weekly activation",
      displayValue: "42",
      source: "Verified system data",
      freshness: "fresh",
      confidence: 0.9,
    }).success,
    false,
  );
  assert.equal(
    integrationConnectionViewSchema.safeParse({
      ...scope,
      id: "integration_1",
      name: "Example",
      provider: "Example provider",
      capabilities: ["Read"],
      scopeSummary: "Workspace",
      health: "active",
      connectionFlow: "server_initiated",
    }).success,
    true,
  );
  assert.equal(
    integrationConnectionViewSchema.safeParse({
      ...scope,
      id: "integration_1",
      name: "Example",
      provider: "Example provider",
      capabilities: ["Read"],
      scopeSummary: "Workspace",
      health: "active",
      lastSyncAt: "not-a-date",
      connectionFlow: "server_initiated",
    }).success,
    false,
  );
});

test("Decision 003 awaiting-authority projection preserves runtime scope and proposal-only fields", () => {
  assert.equal(
    awaitingAuthorityViewSchema.safeParse({
      ...scope,
      runId: "run_1",
      agentId: "agent_1",
      state: "awaiting_authority",
      output: runtimeOutput,
      presentedAt: "2026-08-30T10:00:01.000Z",
    }).success,
    true,
  );
  assert.equal(
    awaitingAuthorityViewSchema.safeParse({
      ...scope,
      runId: "run_other",
      agentId: "agent_1",
      state: "awaiting_authority",
      output: runtimeOutput,
      presentedAt: "2026-08-30T10:00:01.000Z",
    }).success,
    false,
  );
  assert.equal(
    awaitingAuthorityViewSchema.safeParse({
      ...scope,
      runId: "run_1",
      agentId: "agent_1",
      state: "awaiting_authority",
      output: runtimeOutput,
      presentedAt: "2026-08-30T10:00:01.000Z",
      approvalState: "approved",
    }).success,
    false,
  );
});
