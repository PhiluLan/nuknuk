import {
  agentRuntimeOutputSchema,
  type AgentRuntimeOutput,
} from "@nuknuk/api-contracts";
import type { AssembledRunContext, ContextSource } from "./context-builder.ts";
export type { AgentRuntimeOutput } from "@nuknuk/api-contracts";

/**
 * Intelligence-plane runtime seams. This package deliberately does not import
 * persistence, integrations, authority, or UI code. A validated output is a
 * proposal only; an application service must separately persist it and ask the
 * control plane for any authority decision.
 */
export const agentRunStates = [
  "queued",
  "assembling_context",
  "running",
  "awaiting_authority",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "blocked",
] as const;
export type AgentRunState = (typeof agentRunStates)[number];
export type RunScope = Readonly<{
  tenantId: string;
  companyId: string;
  agentId: string;
}>;
export type RunContextManifest = Readonly<{
  runId: string;
  scope: RunScope;
  triggerRef: string;
  charterVersion: number;
  evidence_refs: readonly string[];
  sources?: readonly ContextSource[];
}>;

export const createRunContextManifest = (
  input: RunContextManifest,
): RunContextManifest => {
  requireScope(input.scope);
  if (
    !input.runId ||
    !input.triggerRef ||
    !Number.isInteger(input.charterVersion) ||
    input.charterVersion < 1
  )
    throw new Error("Invalid run context manifest");
  const evidence_refs = [...new Set(input.evidence_refs)].sort();
  if (evidence_refs.some((evidenceRef) => !evidenceRef))
    throw new Error("Invalid evidence reference");
  return Object.freeze({
    ...input,
    scope: Object.freeze({ ...input.scope }),
    evidence_refs: Object.freeze(evidence_refs),
    ...(input.sources
      ? {
          sources: Object.freeze(
            [...input.sources].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
          ),
        }
      : {}),
  });
};

export type StructuredGenerationRequest = Readonly<{
  runId: string;
  manifest: RunContextManifest;
  schemaName: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
  context?: AssembledRunContext;
}>;
export type StructuredGenerationResult = Readonly<{
  output: unknown;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
}>;
export interface ModelProvider {
  generateStructured(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult>;
}
export class ProviderFailure extends Error {
  constructor(
    message: string,
    readonly kind: "provider_failure" | "cancelled" = "provider_failure",
  ) {
    super(message);
  }
}
/** An optional additional validator. The canonical contract is always enforced first. */
export type StructuredOutputSchema = Readonly<{
  name: string;
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: AgentRuntimeOutput }
    | { success: false; issues: readonly string[] };
}>;
export type RunModelPolicy = Readonly<{
  maxOutputTokens: number;
  maxCostCents: number;
  timeoutMs: number;
}>;
export type QueuedRun = Readonly<{
  id: string;
  idempotencyKey: string;
  manifest: RunContextManifest;
  modelPolicy: RunModelPolicy;
  outputSchema?: StructuredOutputSchema;
  context?: AssembledRunContext;
}>;
export type RunTraceEvent = Readonly<{ state: AgentRunState; reason?: string }>;
export type RunResult = Readonly<{
  runId: string;
  state: AgentRunState;
  trace: readonly RunTraceEvent[];
  manifest: RunContextManifest;
  output?: AgentRuntimeOutput;
  failureReason?: string;
  costCents: number;
}>;

/** A durable adapter will replace this in-memory seam once Dev A's persistence contract is reviewed. */
export interface RunIdempotencyStore {
  reserve(
    idempotencyKey: string,
    runId: string,
  ): Promise<Readonly<{ accepted: boolean; existingRunId?: string }>>;
}
export class InMemoryRunIdempotencyStore implements RunIdempotencyStore {
  private readonly runs = new Map<string, string>();
  async reserve(idempotencyKey: string, runId: string) {
    const existingRunId = this.runs.get(idempotencyKey);
    if (existingRunId) return { accepted: false, existingRunId };
    this.runs.set(idempotencyKey, runId);
    return { accepted: true };
  }
}

/** Queue boundary only. It has no integration or execution capability. */
export interface RunQueue {
  enqueue(runId: string): Promise<void>;
}

export class AgentRunExecutor {
  constructor(
    private readonly provider: ModelProvider,
    private readonly idempotency: RunIdempotencyStore,
  ) {}
  async execute(
    run: QueuedRun,
    cancellationSignal?: AbortSignal,
  ): Promise<RunResult> {
    validateRun(run);
    const trace: RunTraceEvent[] = [{ state: "queued" }];
    const reservation = await this.idempotency.reserve(
      run.idempotencyKey,
      run.id,
    );
    if (!reservation.accepted)
      return result(
        run,
        "blocked",
        trace,
        0,
        `duplicate:${reservation.existingRunId ?? "unknown"}`,
      );
    trace.push({ state: "assembling_context" });
    if (cancellationSignal?.aborted)
      return result(run, "cancelled", trace, 0, "cancelled_before_provider");
    trace.push({ state: "running" });
    const timeout = new AbortController();
    const onCancelled = () => timeout.abort();
    cancellationSignal?.addEventListener("abort", onCancelled, { once: true });
    const timer = setTimeout(() => timeout.abort(), run.modelPolicy.timeoutMs);
    try {
      const response = await this.provider.generateStructured({
        runId: run.id,
        manifest: run.manifest,
        schemaName: "AgentRuntimeOutput",
        maxOutputTokens: run.modelPolicy.maxOutputTokens,
        signal: timeout.signal,
        ...(run.context ? { context: run.context } : {}),
      });
      if (cancellationSignal?.aborted)
        return result(run, "cancelled", trace, 0, "cancelled_during_provider");
      if (timeout.signal.aborted)
        return result(run, "timed_out", trace, 0, "provider_timeout");
      if (response.estimatedCostCents > run.modelPolicy.maxCostCents)
        return result(
          run,
          "blocked",
          trace,
          response.estimatedCostCents,
          "cost_cap_exceeded",
        );
      const canonical = validateCanonicalRuntimeOutput(
        response.output,
        run.manifest,
      );
      if (!canonical.success)
        return result(
          run,
          "failed",
          trace,
          response.estimatedCostCents,
          `invalid_output:${canonical.issues.join(",")}`,
        );
      const parsed = run.outputSchema?.safeParse(canonical.data) ?? canonical;
      if (!parsed.success)
        return result(
          run,
          "failed",
          trace,
          response.estimatedCostCents,
          `invalid_output:${parsed.issues.join(",")}`,
        );
      return result(
        run,
        "awaiting_authority",
        trace,
        response.estimatedCostCents,
        undefined,
        parsed.data,
      );
    } catch (error) {
      if (cancellationSignal?.aborted)
        return result(run, "cancelled", trace, 0, "provider_cancelled");
      if (timeout.signal.aborted)
        return result(run, "timed_out", trace, 0, "provider_timeout");
      if (error instanceof ProviderFailure && error.kind === "cancelled")
        return result(run, "cancelled", trace, 0, "provider_cancelled");
      return result(
        run,
        "failed",
        trace,
        0,
        error instanceof Error ? error.message : "provider_failure",
      );
    } finally {
      clearTimeout(timer);
      cancellationSignal?.removeEventListener("abort", onCancelled);
    }
  }
}

export class MockProvider implements ModelProvider {
  constructor(
    private readonly next: () =>
      Promise<StructuredGenerationResult> | StructuredGenerationResult,
  ) {}
  async generateStructured(
    request: StructuredGenerationRequest,
  ): Promise<StructuredGenerationResult> {
    if (request.signal?.aborted)
      throw new ProviderFailure("Provider request cancelled", "cancelled");
    return this.next();
  }
}

const result = (
  run: QueuedRun,
  state: AgentRunState,
  trace: readonly RunTraceEvent[],
  costCents: number,
  failureReason?: string,
  output?: AgentRuntimeOutput,
): RunResult =>
  Object.freeze({
    runId: run.id,
    state,
    trace: Object.freeze([
      ...trace,
      { state, ...(failureReason ? { reason: failureReason } : {}) },
    ]),
    manifest: run.manifest,
    ...(output === undefined ? {} : { output }),
    ...(failureReason ? { failureReason } : {}),
    costCents,
  });
const requireScope = (scope: RunScope): void => {
  if (!scope.tenantId || !scope.companyId || !scope.agentId)
    throw new Error(
      "Run scope requires tenant, company, and agent identifiers",
    );
};
const validateCanonicalRuntimeOutput = (
  value: unknown,
  manifest: RunContextManifest,
):
  | { success: true; data: AgentRuntimeOutput }
  | { success: false; issues: readonly string[] } => {
  const parsed = agentRuntimeOutputSchema.safeParse(value);
  if (!parsed.success)
    return {
      success: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}:${issue.message}`,
      ),
    };
  const output = parsed.data;
  const scope = manifest.scope;
  const issues: string[] = [];
  if (output.run_id !== manifest.runId) issues.push("run_id_out_of_scope");
  if (output.tenant_id !== scope.tenantId)
    issues.push("tenant_id_out_of_scope");
  if (output.company_id !== scope.companyId)
    issues.push("company_id_out_of_scope");
  if (output.agent_id !== scope.agentId) issues.push("agent_id_out_of_scope");
  const allowedEvidenceRefs = new Set(manifest.evidence_refs);
  for (const claim of output.claims)
    for (const evidenceRef of claim.evidence_refs)
      if (!allowedEvidenceRefs.has(evidenceRef))
        issues.push(`evidence_ref_out_of_context:${evidenceRef}`);
  return issues.length === 0
    ? { success: true, data: output }
    : { success: false, issues };
};
const validateRun = (run: QueuedRun): void => {
  if (!run.id || !run.idempotencyKey || run.manifest.runId !== run.id)
    throw new Error("Invalid queued run identity");
  requireScope(run.manifest.scope);
  if (
    run.modelPolicy.maxOutputTokens < 1 ||
    run.modelPolicy.maxCostCents < 0 ||
    run.modelPolicy.timeoutMs < 1
  )
    throw new Error("Invalid model policy");
};

export { ContextBuilder } from "./context-builder.ts";
export type {
  AssembledRunContext,
  ContextBuildInput,
  ContextEvidence,
  ContextSource,
  EvidenceRetriever,
} from "./context-builder.ts";
export { SpecialistAnalysisFlow } from "./specialist-analysis.ts";
export type {
  SpecialistAnalysisRequest,
  SpecialistAnalysisResult,
} from "./specialist-analysis.ts";
export { ExecutiveCycleComposer } from "./executive-cycle.ts";
export type {
  ExecutiveSynthesisInput,
  SpecialistProposal,
} from "./executive-cycle.ts";
