import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentRunExecutor,
  ContextBuilder,
  InMemoryRunIdempotencyStore,
  MockProvider,
  PersistedSpecialistAnalysisFlow,
  type AgentRunApplicationService,
  type AgentRuntimeOutput,
  type CompanyIntelligenceContextService,
  type ContextBuildInput,
} from "../src/index.ts";

const scope = {
  tenantId: "tenant_1",
  companyId: "company_1",
  agentId: "agent_1",
};
const context: ContextBuildInput = {
  runId: "run_1",
  scope,
  mandateRef: "mandate_1",
  triggerRef: "trigger_1",
  charter: {
    id: "charter_1",
    version: 1,
    allowedEvidenceClassifications: ["verified_fact"],
  },
  governanceConstraints: [],
  objectives: [],
  companyState: [],
  evidence: [
    {
      id: "evidence_1",
      scope,
      classification: "verified_fact",
      contentRef: "artifact_1",
      collectedAt: "2026-09-02T10:00:00.000Z",
      freshnessSeconds: 3_600,
      confidence: 1,
    },
  ],
  modelPolicy: { maxOutputTokens: 100, maxCostCents: 10, timeoutMs: 100 },
  budget: { maxSources: 20, maxChars: 1_000 },
  asOf: "2026-09-02T10:01:00.000Z",
};
const output: AgentRuntimeOutput = {
  run_id: "run_1",
  tenant_id: scope.tenantId,
  company_id: scope.companyId,
  agent_id: scope.agentId,
  summary: "Scoped proposal",
  claims: [
    {
      statement: "Observed",
      classification: "verified_fact",
      evidence_refs: ["evidence_1"],
      confidence: 1,
    },
  ],
  recommendations: [],
  proposed_tasks: [],
  proposed_actions: [],
  uncertainty: [],
  overall_confidence: 1,
  generated_at: "2026-09-02T10:01:00.000Z",
};

const contextService: CompanyIntelligenceContextService = {
  loadContext: async () => context,
};
const service = (failManifest = false) => {
  const calls: string[] = [];
  const applicationService: AgentRunApplicationService = {
    reserveRun: async () => {
      calls.push("reserve");
      return { accepted: true, existingRunId: "run_1" };
    },
    persistContextManifest: async () => {
      calls.push("manifest");
      if (failManifest) throw new Error("storage unavailable");
      return { manifestRef: "manifest_1" };
    },
    transitionRun: async (input) => {
      calls.push(`transition:${input.state}`);
    },
    recordUsage: async () => {
      calls.push("usage");
    },
  };
  return { calls, applicationService };
};

test("persisted specialist flow requests reservation, manifest, usage, and awaiting-authority transitions through the application boundary", async () => {
  const boundary = service();
  const flow = new PersistedSpecialistAnalysisFlow(
    contextService,
    new ContextBuilder(),
    new AgentRunExecutor(
      new MockProvider(() => ({
        output,
        inputTokens: 3,
        outputTokens: 2,
        estimatedCostCents: 1,
      })),
      new InMemoryRunIdempotencyStore(),
    ),
    boundary.applicationService,
  );
  const result = await flow.run({
    queuedRun: {
      id: "run_1",
      idempotencyKey: "trigger_1",
      modelPolicy: context.modelPolicy,
    },
    scope,
    triggerRef: "trigger_1",
    auditCorrelationId: "correlation_1",
  });
  assert.equal(result.state, "awaiting_authority");
  assert.deepEqual(boundary.calls, [
    "reserve",
    "transition:assembling_context",
    "manifest",
    "transition:running",
    "usage",
    "transition:awaiting_authority",
  ]);
});

test("persistence handoff failure is failed and never returns a proposal", async () => {
  const boundary = service(true);
  const flow = new PersistedSpecialistAnalysisFlow(
    contextService,
    new ContextBuilder(),
    new AgentRunExecutor(
      new MockProvider(() => ({
        output,
        inputTokens: 3,
        outputTokens: 2,
        estimatedCostCents: 1,
      })),
      new InMemoryRunIdempotencyStore(),
    ),
    boundary.applicationService,
  );
  const result = await flow.run({
    queuedRun: {
      id: "run_1",
      idempotencyKey: "trigger_1",
      modelPolicy: context.modelPolicy,
    },
    scope,
    triggerRef: "trigger_1",
    auditCorrelationId: "correlation_1",
  });
  assert.equal(result.state, "failed");
  assert.equal(result.output, undefined);
  assert.match(result.failureReason ?? "", /persistence_handoff_failed/);
});
