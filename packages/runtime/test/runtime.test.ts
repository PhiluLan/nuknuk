import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentRunExecutor,
  InMemoryRunIdempotencyStore,
  MockProvider,
  ProviderFailure,
  createRunContextManifest,
  type AgentRuntimeOutput,
  type QueuedRun,
  type StructuredOutputSchema,
} from "../src/index.ts";

const output = (): AgentRuntimeOutput => ({
  run_id: "run_1",
  tenant_id: "tenant_1",
  company_id: "company_1",
  agent_id: "agent_1",
  summary: "Scoped proposal",
  claims: [
    {
      statement: "Observed signal",
      classification: "verified_fact",
      evidence_refs: ["evidence_a"],
      confidence: 0.9,
    },
  ],
  recommendations: [{ summary: "Review the signal" }],
  proposed_tasks: [{ title: "Investigate the signal" }],
  proposed_actions: [{ intent: "Request human review" }],
  uncertainty: [{ type: "low_confidence" }],
  overall_confidence: 0.8,
  generated_at: "2026-08-30T10:00:00.000Z",
});
const run = (overrides: Partial<QueuedRun> = {}): QueuedRun => ({
  id: "run_1",
  idempotencyKey: "event_1:agent_1",
  manifest: createRunContextManifest({
    runId: "run_1",
    scope: { tenantId: "tenant_1", companyId: "company_1", agentId: "agent_1" },
    triggerRef: "event_1",
    charterVersion: 1,
    evidence_refs: ["evidence_b", "evidence_a"],
  }),
  modelPolicy: { maxOutputTokens: 500, maxCostCents: 25, timeoutMs: 100 },
  ...overrides,
});
const execute = (runtimeOutput: unknown, queuedRun = run()) =>
  new AgentRunExecutor(
    new MockProvider(() => ({
      output: runtimeOutput,
      inputTokens: 12,
      outputTokens: 5,
      estimatedCostCents: 3,
    })),
    new InMemoryRunIdempotencyStore(),
  ).execute(queuedRun);

test("a scoped canonical output validates and stops at awaiting authority", async () => {
  const result = await execute(output());
  assert.equal(result.state, "awaiting_authority");
  assert.equal(result.output?.summary, "Scoped proposal");
  assert.deepEqual(result.manifest.evidence_refs, ["evidence_a", "evidence_b"]);
});

test("runtime rejects invented evidence and a verified fact without evidence", async () => {
  const invented = output();
  invented.claims[0]!.evidence_refs = ["invented_evidence"];
  assert.equal((await execute(invented)).state, "failed");
  const uncited = output();
  uncited.claims[0]!.evidence_refs = [];
  assert.equal((await execute(uncited)).state, "failed");
});

test("runtime rejects forbidden execution fields and malformed confidence", async () => {
  const forbidden = {
    ...output(),
    proposed_actions: [{ intent: "Dispatch", authorization: "allow" }],
  };
  assert.equal((await execute(forbidden)).state, "failed");
  assert.equal(
    (await execute({ ...output(), overall_confidence: 1.1 })).state,
    "failed",
  );
});

test("runtime rejects output identifiers outside the manifest scope", async () => {
  for (const field of ["tenant_id", "company_id", "agent_id"] as const) {
    const out = output();
    out[field] = `other_${field}`;
    assert.equal((await execute(out)).state, "failed", field);
  }
});

test("an optional validator can add test-only checks without bypassing canonical validation", async () => {
  const stricter: StructuredOutputSchema = {
    name: "test_policy",
    safeParse: () => ({ success: false, issues: ["test_rejection"] }),
  };
  const result = await execute(output(), run({ outputSchema: stricter }));
  assert.equal(result.state, "failed");
  assert.match(result.failureReason ?? "", /test_rejection/);
});

test("timeout, cancellation, duplicate, and cost-cap paths do not accept output", async () => {
  const timeoutProvider = {
    generateStructured: ({ signal }: { signal?: AbortSignal }) =>
      new Promise((_, reject) =>
        signal?.addEventListener(
          "abort",
          () => reject(new ProviderFailure("stopped", "cancelled")),
          { once: true },
        ),
      ),
  };
  const timedOut = await new AgentRunExecutor(
    timeoutProvider,
    new InMemoryRunIdempotencyStore(),
  ).execute(
    run({
      modelPolicy: { maxOutputTokens: 500, maxCostCents: 25, timeoutMs: 5 },
    }),
  );
  assert.equal(timedOut.state, "timed_out");
  const expensive = new AgentRunExecutor(
    new MockProvider(() => ({
      output: output(),
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostCents: 99,
    })),
    new InMemoryRunIdempotencyStore(),
  );
  assert.equal(
    (await expensive.execute(run({ idempotencyKey: "capped" }))).state,
    "blocked",
  );
  const cancellation = new AbortController();
  cancellation.abort();
  assert.equal(
    (
      await expensive.execute(
        run({ idempotencyKey: "cancelled" }),
        cancellation.signal,
      )
    ).state,
    "cancelled",
  );
  const first = await expensive.execute(run({ idempotencyKey: "duplicate" }));
  const duplicate = await expensive.execute(
    run({ idempotencyKey: "duplicate" }),
  );
  assert.equal(first.state, "blocked");
  assert.match(duplicate.failureReason ?? "", /duplicate/);
});
