import assert from "node:assert/strict";
import test from "node:test";
import {
  ControlPlaneProblem,
  ControlPlaneService,
  handleControlPlaneRequest,
  type ControlPlaneStore,
} from "../src/index.ts";

const scope = { tenantId: "tenant_a", companyId: "company_a" };
const actor = { id: "human_a", type: "human" as const };

const store = (
  overrides: Partial<ControlPlaneStore> = {},
): ControlPlaneStore => ({
  createAgentCharterVersion: async () => "charter_a",
  createObjective: async () => "objective_a",
  recordEvidence: async () => "evidence_a",
  recordStateObservation: async () => "observation_a",
  reserveAgentRun: async (input) => ({
    accepted: true,
    existingRunId: input.runId,
  }),
  transitionAgentRun: async () => undefined,
  attachRunContextManifest: async () => "manifest_a",
  recordUsage: async () => "usage_a",
  persistAwaitingAuthorityOutput: async () => undefined,
  organizationGraph: async () => ({ ...scope, nodes: [] }),
  agentDetail: async () => ({
    ...scope,
    id: "agent_a",
    name: "Agent A",
    status: "active",
    organizationNodeId: "node_a",
    reportingLine: "Founder",
    charter: {
      id: "charter_a",
      version: 1,
      mission: "Test",
      responsibilities: [],
      allowedDataCapabilities: [],
      allowedToolCapabilities: [],
    },
    authoritySummary: "No authority granted",
    currentWorkSummary: "No current work",
    costSummary: "No usage recorded",
    recentActivitySummary: "No activity",
  }),
  companyStateCards: async () => [],
  objectives: async () => [],
  awaitingAuthority: async () => [],
  ...overrides,
});

test("mature mutation handler requires an authenticated actor and idempotency key", async () => {
  const service = new ControlPlaneService(store());
  const unauthenticated = await handleControlPlaneRequest(service, {
    method: "POST",
    path: "/api/v1/objectives",
    headers: {},
    body: {},
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.contentType, "application/problem+json");

  const missingKey = await handleControlPlaneRequest(service, {
    actor,
    method: "POST",
    path: "/api/v1/objectives",
    headers: {},
    body: { ...scope, title: "Keep scope", description: "Verify state" },
  });
  assert.equal(missingKey.status, 422);
  assert.deepEqual(missingKey.body, {
    type: "https://nuknuk.dev/problems/idempotency-key-required",
    title: "A valid Idempotency-Key is required",
    status: 422,
    detail:
      "Mutations must include an idempotency key between 8 and 256 characters.",
  });
});

test("objective mutation binds actor and idempotency key to the server store", async () => {
  let received: Record<string, unknown> | undefined;
  const service = new ControlPlaneService(
    store({
      createObjective: async (input) => {
        received = input;
        return "objective_a";
      },
    }),
  );
  const result = await service.createObjective(
    actor,
    { ...scope, title: "Keep scope", description: "Verify state" },
    "objective-001",
  );
  assert.equal(result, "objective_a");
  assert.equal(received?.actorId, actor.id);
  assert.equal(received?.idempotencyKey, "objective-001");
});

test("detailed objective preserves target date and canonical success-measure references", async () => {
  let received: Record<string, unknown> | undefined;
  const service = new ControlPlaneService(
    store({
      createObjective: async (input) => {
        received = input;
        return "objective_detailed";
      },
    }),
  );
  await service.createObjectiveDetailed(
    actor,
    {
      ...scope,
      title: "Retention",
      description: "Improve monthly retention",
      targetDate: "2026-12-31",
      successMeasureRefs: ["metric_retention"],
    },
    "objective-detailed-001",
  );
  assert.equal(received?.targetDate, "2026-12-31");
  assert.deepEqual(received?.successMeasureRefs, ["metric_retention"]);
});

test("evidence trust elevation and malformed lineage are denied before persistence", async () => {
  let persisted = false;
  const service = new ControlPlaneService(
    store({
      recordEvidence: async () => {
        persisted = true;
        return "evidence_a";
      },
    }),
  );
  await assert.rejects(
    () =>
      service.recordEvidence(
        actor,
        {
          ...scope,
          type: "verified_system_data",
          source: "untrusted-client",
          contentPointer: "artifact://untrusted",
          collectedAt: "2026-09-02T00:00:00.000Z",
          confidence: 1,
        },
        "evidence-trust-001",
      ),
    (error: unknown) =>
      error instanceof ControlPlaneProblem && error.status === 403,
  );
  assert.equal(persisted, false);
});

test("trusted ingestion can record evidence metadata without granting authority", async () => {
  let received: Record<string, unknown> | undefined;
  const service = new ControlPlaneService(
    store({
      recordEvidence: async (input) => {
        received = input;
        return "evidence_a";
      },
    }),
    { canRecordVerifiedSystemData: async () => true },
  );
  await service.recordEvidence(
    actor,
    {
      ...scope,
      type: "verified_system_data",
      source: "trusted-ingestion",
      contentPointer: "artifact://system/export",
      collectedAt: "2026-09-02T00:00:00.000Z",
      confidence: 1,
      freshnessSeconds: 60,
      contentHash: { algorithm: "sha256", value: "b".repeat(64) },
      sourceVersionRef: "export-42",
      parentEvidenceRefs: ["evidence_parent"],
    },
    "evidence-trusted-001",
  );
  assert.equal(received?.contentHash, `sha256:${"b".repeat(64)}`);
  assert.deepEqual(received?.parentEvidenceRefs, ["evidence_parent"]);
  assert.equal(received?.actorId, actor.id);
});

test("agent-run duplicate reservation returns the original run and does not mint another", async () => {
  const service = new ControlPlaneService(
    store({
      reserveAgentRun: async () => ({
        accepted: false,
        existingRunId: "run_original",
      }),
    }),
  );
  const reservation = await service.reserveAgentRun(actor, {
    ...scope,
    agentId: "agent_a",
    runId: "run_retry",
    triggerRef: "schedule:daily",
    idempotencyKey: "run-key-001",
  });
  assert.deepEqual(reservation, {
    accepted: false,
    existingRunId: "run_original",
  });
});

test("runtime output outside the reserved tenant/company/agent/run scope is rejected before persistence", async () => {
  let persisted = false;
  const service = new ControlPlaneService(
    store({
      persistAwaitingAuthorityOutput: async () => {
        persisted = true;
      },
    }),
  );
  assert.throws(
    () =>
      service.persistAwaitingAuthorityOutput(actor, {
        ...scope,
        agentId: "agent_a",
        runId: "run_a",
        outputPointer: "artifact://run_a/output",
        output: {
          run_id: "run_a",
          tenant_id: "tenant_b",
          company_id: "company_a",
          agent_id: "agent_a",
          summary: "Proposal only",
          claims: [],
          recommendations: [],
          proposed_tasks: [],
          proposed_actions: [],
          uncertainty: [],
          overall_confidence: 0.5,
          generated_at: "2026-09-02T00:00:00.000Z",
        },
      }),
    (error: unknown) =>
      error instanceof ControlPlaneProblem && error.status === 403,
  );
  assert.equal(persisted, false);
});

test("read projections fail closed when a store returns a different tenant scope", async () => {
  const service = new ControlPlaneService(
    store({
      organizationGraph: async () => ({
        ...scope,
        tenantId: "tenant_b",
        nodes: [],
      }),
    }),
  );
  await assert.rejects(() => service.organizationGraph(actor, scope));
});
