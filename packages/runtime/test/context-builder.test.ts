import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentRunExecutor,
  ContextBuilder,
  ExecutiveCycleComposer,
  InMemoryRunIdempotencyStore,
  MockProvider,
  ProviderFailure,
  SpecialistAnalysisFlow,
  type AgentRuntimeOutput,
  type ContextBuildInput,
  type ContextEvidence,
} from "../src/index.ts";

const scope = {
  tenantId: "tenant_1",
  companyId: "company_1",
  agentId: "agent_1",
};
const freshEvidence: ContextEvidence = {
  id: "evidence_fresh",
  scope,
  classification: "verified_fact",
  contentRef: "artifact_fresh",
  collectedAt: "2026-08-30T09:59:00.000Z",
  freshnessSeconds: 3_600,
  confidence: 0.95,
};
const staleEvidence: ContextEvidence = {
  ...freshEvidence,
  id: "evidence_stale",
  classification: "external_information",
  collectedAt: "2026-08-29T00:00:00.000Z",
  freshnessSeconds: 60,
  confidence: 0.4,
};
const buildInput = (
  overrides: Partial<ContextBuildInput> = {},
): ContextBuildInput => ({
  runId: "run_1",
  scope,
  mandateRef: "mandate_1",
  triggerRef: "trigger_1",
  charter: {
    id: "charter_1",
    version: 1,
    allowedEvidenceClassifications: [
      "verified_fact",
      "external_information",
      "insufficient_evidence",
    ],
  },
  governanceConstraints: ["no_execution"],
  objectives: [{ id: "objective_1", scope, summary: "Improve quality" }],
  companyState: [
    {
      id: "state_1",
      scope,
      metricKey: "quality",
      value: 80,
      observedAt: "2026-08-30T09:58:00.000Z",
      evidenceRefs: [freshEvidence.id],
    },
  ],
  evidence: [freshEvidence, staleEvidence],
  priorDecisions: [
    {
      id: "decision_placeholder",
      scope,
      summary: "Prior decision placeholder",
    },
  ],
  workPlaceholders: [
    { id: "work_placeholder", scope, summary: "Prior work placeholder" },
  ],
  modelPolicy: { maxOutputTokens: 500, maxCostCents: 20, timeoutMs: 100 },
  budget: { maxSources: 20, maxChars: 5_000 },
  asOf: "2026-08-30T10:00:00.000Z",
  ...overrides,
});
const output = (evidenceRefs = [freshEvidence.id]): AgentRuntimeOutput => ({
  run_id: "run_1",
  tenant_id: scope.tenantId,
  company_id: scope.companyId,
  agent_id: scope.agentId,
  summary: "Specialist review",
  claims: [
    {
      statement: "Quality signal observed",
      classification: "verified_fact",
      evidence_refs: evidenceRefs,
      confidence: 0.9,
    },
  ],
  recommendations: [{ summary: "Review quality trend" }],
  proposed_tasks: [{ title: "Investigate quality" }],
  proposed_actions: [],
  uncertainty: [],
  overall_confidence: 0.9,
  generated_at: "2026-08-30T10:00:00.000Z",
});

test("ContextBuilder filters retrieval by tenant, company, agent, and charter scope before ranking", async () => {
  const crossTenant = {
    ...freshEvidence,
    id: "evidence_other_tenant",
    scope: { ...scope, tenantId: "tenant_other" },
  };
  const otherAgent = {
    ...freshEvidence,
    id: "evidence_other_agent",
    scope: { ...scope, agentId: "agent_other" },
  };
  const disallowed = {
    ...freshEvidence,
    id: "evidence_disallowed",
    classification: "human_input" as const,
  };
  const context = await new ContextBuilder().build(
    buildInput({
      retrieval: {
        retrieve: async () => [
          crossTenant,
          otherAgent,
          disallowed,
          freshEvidence,
        ],
      },
    }),
  );
  assert.deepEqual(
    context.evidence.map((item) => item.id),
    ["evidence_fresh", "evidence_fresh", "evidence_stale"],
  );
  assert.deepEqual(context.manifest.evidence_refs, [
    "evidence_fresh",
    "evidence_stale",
  ]);
  assert.equal(
    context.sources.some((item) => item.id.includes("other_tenant")),
    false,
  );
  assert.equal(
    context.evidence.some((item) => item.id === "evidence_disallowed"),
    false,
  );
});

test("executive composition accepts only scope-matched specialist proposals and never authorizes them", () => {
  const composer = new ExecutiveCycleComposer();
  const composed = composer.compose(scope, [
    { runId: "run_b", scope, output: output() },
    { runId: "run_a", scope, output: output() },
  ]);
  assert.deepEqual(
    composed.specialistProposals.map((item) => item.runId),
    ["run_a", "run_b"],
  );
  assert.throws(() =>
    composer.compose(scope, [
      {
        runId: "run_other",
        scope: { ...scope, companyId: "other_company" },
        output: output(),
      },
    ]),
  );
});

test("ContextBuilder compacts deterministically and retains traceable scoped sources", async () => {
  const builder = new ContextBuilder();
  const first = await builder.build(
    buildInput({ budget: { maxSources: 5, maxChars: 100 } }),
  );
  const second = await builder.build(
    buildInput({ budget: { maxSources: 5, maxChars: 100 } }),
  );
  assert.deepEqual(first.sources, second.sources);
  assert.equal(first.sources.length, 5);
  assert.ok(first.omittedSourceIds.length > 0);
  assert.ok(first.sources.every((item) => item.id && item.reference));
});

test("specialist analysis composes state and evidence into a canonical proposal awaiting authority", async () => {
  const flow = new SpecialistAnalysisFlow(
    new ContextBuilder(),
    new AgentRunExecutor(
      new MockProvider(() => ({
        output: output(),
        inputTokens: 10,
        outputTokens: 10,
        estimatedCostCents: 2,
      })),
      new InMemoryRunIdempotencyStore(),
    ),
  );
  const result = await flow.run({
    queuedRun: {
      id: "run_1",
      idempotencyKey: "trigger_1",
      modelPolicy: buildInput().modelPolicy,
    },
    context: buildInput(),
  });
  assert.equal(result.run.state, "awaiting_authority");
  assert.equal(result.proposal?.claims[0]?.classification, "verified_fact");
  assert.equal(
    result.run.manifest.evidence_refs.includes(freshEvidence.id),
    true,
  );
});

test("evaluation fixtures preserve stale/conflicting/insufficient evidence as proposals rather than facts", async () => {
  const builder = new ContextBuilder();
  const stale = await builder.build(buildInput());
  assert.equal(
    stale.evidence.find((item) => item.id === staleEvidence.id)?.classification,
    "external_information",
  );
  const conflicting: AgentRuntimeOutput = {
    ...output([freshEvidence.id, staleEvidence.id]),
    claims: [
      {
        statement: "Signals conflict",
        classification: "external_information",
        evidence_refs: [freshEvidence.id, staleEvidence.id],
        confidence: 0.4,
      },
    ],
    uncertainty: [{ type: "conflicting_evidence" }, { type: "stale_evidence" }],
    overall_confidence: 0.4,
  };
  const insufficient: AgentRuntimeOutput = {
    ...output([]),
    claims: [
      {
        statement: "No verified conclusion",
        classification: "insufficient_evidence",
        evidence_refs: [],
        confidence: 0,
      },
    ],
    uncertainty: [{ type: "missing_evidence" }],
    overall_confidence: 0,
  };
  const executor = new AgentRunExecutor(
    new MockProvider(() => ({
      output: conflicting,
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostCents: 1,
    })),
    new InMemoryRunIdempotencyStore(),
  );
  const conflictResult = await executor.execute({
    id: "run_1",
    idempotencyKey: "conflict",
    manifest: stale.manifest,
    modelPolicy: buildInput().modelPolicy,
  });
  assert.equal(conflictResult.state, "awaiting_authority");
  const insufficientResult = await new AgentRunExecutor(
    new MockProvider(() => ({
      output: insufficient,
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostCents: 1,
    })),
    new InMemoryRunIdempotencyStore(),
  ).execute({
    id: "run_1",
    idempotencyKey: "insufficient",
    manifest: stale.manifest,
    modelPolicy: buildInput().modelPolicy,
  });
  assert.equal(insufficientResult.state, "awaiting_authority");
});

test("evaluation fixtures keep empty state, provider failure, cap, and duplicate paths safe", async () => {
  const empty = await new ContextBuilder().build(
    buildInput({
      companyState: [],
      evidence: [],
      budget: { maxSources: 10, maxChars: 1_000 },
    }),
  );
  assert.deepEqual(empty.manifest.evidence_refs, []);
  const providerFailure = await new AgentRunExecutor(
    new MockProvider(() => {
      throw new ProviderFailure("provider unavailable");
    }),
    new InMemoryRunIdempotencyStore(),
  ).execute({
    id: "run_1",
    idempotencyKey: "failure",
    manifest: empty.manifest,
    modelPolicy: buildInput().modelPolicy,
  });
  assert.equal(providerFailure.state, "failed");
  const store = new InMemoryRunIdempotencyStore();
  const costly = new AgentRunExecutor(
    new MockProvider(() => ({
      output: output(),
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostCents: 99,
    })),
    store,
  );
  const capped = await costly.execute({
    id: "run_1",
    idempotencyKey: "duplicate",
    manifest: empty.manifest,
    modelPolicy: buildInput().modelPolicy,
  });
  const duplicate = await costly.execute({
    id: "run_1",
    idempotencyKey: "duplicate",
    manifest: empty.manifest,
    modelPolicy: buildInput().modelPolicy,
  });
  assert.equal(capped.state, "blocked");
  assert.match(duplicate.failureReason ?? "", /duplicate/);
});
