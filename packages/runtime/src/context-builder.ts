import type { RunContextManifest, RunModelPolicy, RunScope } from "./index.ts";
import { createRunContextManifest } from "./index.ts";

export type EvidenceClassification =
  | "verified_fact"
  | "human_input"
  | "external_information"
  | "agent_inference"
  | "insufficient_evidence";

export type ContextEvidence = Readonly<{
  id: string;
  scope: RunScope;
  classification: EvidenceClassification;
  contentRef: string;
  collectedAt: string;
  freshnessSeconds: number;
  confidence: number;
  conflictsWith?: readonly string[];
}>;
export type CompanyStateInput = Readonly<{
  id: string;
  scope: Pick<RunScope, "tenantId" | "companyId">;
  metricKey: string;
  value: string | number | boolean;
  observedAt: string;
  evidenceRefs: readonly string[];
  freshnessSeconds?: number;
}>;
export type ScopedContextItem = Readonly<{
  id: string;
  scope: Pick<RunScope, "tenantId" | "companyId">;
  summary: string;
}>;
export type EvidenceRetrievalRequest = Readonly<{
  scope: RunScope;
  allowedClassifications: readonly EvidenceClassification[];
  queryRefs: readonly string[];
  limit: number;
}>;
export interface EvidenceRetriever {
  retrieve(
    request: EvidenceRetrievalRequest,
  ): Promise<readonly ContextEvidence[]>;
}
export type ContextBudget = Readonly<{ maxSources: number; maxChars: number }>;
export type ContextSource = Readonly<{
  id: string;
  kind:
    | "mandate"
    | "trigger"
    | "charter"
    | "governance"
    | "objective"
    | "state"
    | "evidence"
    | "decision"
    | "work"
    | "limits";
  scope: Pick<RunScope, "tenantId" | "companyId"> | "global";
  reference: string;
  chars: number;
}>;
export type ContextBuildInput = Readonly<{
  runId: string;
  scope: RunScope;
  mandateRef: string;
  triggerRef: string;
  charter: Readonly<{
    id: string;
    version: number;
    allowedEvidenceClassifications: readonly EvidenceClassification[];
  }>;
  governanceConstraints: readonly string[];
  objectives: readonly ScopedContextItem[];
  companyState: readonly CompanyStateInput[];
  evidence: readonly ContextEvidence[];
  priorDecisions?: readonly ScopedContextItem[];
  workPlaceholders?: readonly ScopedContextItem[];
  modelPolicy: RunModelPolicy;
  budget: ContextBudget;
  asOf: string;
  retrieval?: EvidenceRetriever;
}>;
export type AssembledRunContext = Readonly<{
  manifest: RunContextManifest;
  sources: readonly ContextSource[];
  evidence: readonly ContextEvidence[];
  uncertainty: readonly ContextUncertainty[];
  omittedSourceIds: readonly string[];
  modelPolicy: RunModelPolicy;
  outputSchemaName: "AgentRuntimeOutput";
}>;
export type ContextUncertainty = Readonly<{
  type: "missing_evidence" | "stale_evidence" | "conflicting_evidence";
  sourceRefs: readonly string[];
}>;

export class ContextBuilder {
  async build(input: ContextBuildInput): Promise<AssembledRunContext> {
    assertScope(input.scope);
    assertBudget(input.budget);
    const scopedEvidence = await this.retrieveEvidence(input);
    const state = input.companyState.filter((item) =>
      sameCompany(item.scope, input.scope),
    );
    const sources = [
      source("mandate", input.mandateRef, "global"),
      source("trigger", input.triggerRef, {
        tenantId: input.scope.tenantId,
        companyId: input.scope.companyId,
      }),
      source("charter", input.charter.id, {
        tenantId: input.scope.tenantId,
        companyId: input.scope.companyId,
      }),
      ...input.governanceConstraints.map((item) =>
        source("governance", item, "global"),
      ),
      ...input.objectives
        .filter((item) => sameCompany(item.scope, input.scope))
        .map((item) => source("objective", item.id, item.scope)),
      ...state.map((item) => source("state", item.id, item.scope)),
      ...scopedEvidence.map((item) =>
        source("evidence", item.id, {
          tenantId: item.scope.tenantId,
          companyId: item.scope.companyId,
        }),
      ),
      ...(input.priorDecisions ?? [])
        .filter((item) => sameCompany(item.scope, input.scope))
        .map((item) => source("decision", item.id, item.scope)),
      ...(input.workPlaceholders ?? [])
        .filter((item) => sameCompany(item.scope, input.scope))
        .map((item) => source("work", item.id, item.scope)),
      source(
        "limits",
        `${input.modelPolicy.maxOutputTokens}:${input.modelPolicy.maxCostCents}:${input.modelPolicy.timeoutMs}`,
        "global",
      ),
    ];
    const compacted = compact(sources, input.budget);
    const evidenceRefs = compacted.included
      .filter((item) => item.kind === "evidence")
      .map((item) => item.reference);
    const manifest = createRunContextManifest({
      runId: input.runId,
      scope: input.scope,
      triggerRef: input.triggerRef,
      charterVersion: input.charter.version,
      evidence_refs: evidenceRefs,
      sources: compacted.included,
    });
    const includedEvidence = scopedEvidence.filter((item) =>
      evidenceRefs.includes(item.id),
    );
    const uncertainty = deriveUncertainty(state, includedEvidence, input.asOf);
    return Object.freeze({
      manifest,
      sources: compacted.included,
      evidence: Object.freeze(scopedEvidence),
      uncertainty: Object.freeze(uncertainty),
      omittedSourceIds: compacted.omitted.map((item) => item.id),
      modelPolicy: input.modelPolicy,
      outputSchemaName: "AgentRuntimeOutput",
    });
  }

  private async retrieveEvidence(
    input: ContextBuildInput,
  ): Promise<readonly ContextEvidence[]> {
    const requested = input.retrieval
      ? await input.retrieval.retrieve({
          scope: input.scope,
          allowedClassifications: input.charter.allowedEvidenceClassifications,
          queryRefs: input.companyState
            .filter((item) => sameCompany(item.scope, input.scope))
            .flatMap((item) => item.evidenceRefs),
          limit: input.budget.maxSources,
        })
      : [];
    return [...input.evidence, ...requested]
      .filter(
        (item) =>
          sameScope(item.scope, input.scope) &&
          input.charter.allowedEvidenceClassifications.includes(
            item.classification,
          ),
      )
      .sort(
        (left, right) =>
          evidenceRank(right, input.asOf).localeCompare(
            evidenceRank(left, input.asOf),
          ) || left.id.localeCompare(right.id),
      );
  }
}

const source = (
  kind: ContextSource["kind"],
  reference: string,
  scope: ContextSource["scope"],
): ContextSource =>
  Object.freeze({
    id: `${kind}:${reference}`,
    kind,
    scope,
    reference,
    chars: reference.length,
  });
const compact = (sources: readonly ContextSource[], budget: ContextBudget) => {
  const ordered = [...sources].sort(
    (left, right) =>
      kindRank(left.kind) - kindRank(right.kind) ||
      left.id.localeCompare(right.id),
  );
  const included: ContextSource[] = [];
  const omitted: ContextSource[] = [];
  let chars = 0;
  for (const item of ordered)
    if (
      included.length < budget.maxSources &&
      chars + item.chars <= budget.maxChars
    ) {
      included.push(item);
      chars += item.chars;
    } else omitted.push(item);
  return { included: Object.freeze(included), omitted: Object.freeze(omitted) };
};
const kindRank = (kind: ContextSource["kind"]) =>
  [
    "mandate",
    "trigger",
    "charter",
    "governance",
    "objective",
    "state",
    "evidence",
    "decision",
    "work",
    "limits",
  ].indexOf(kind);
const evidenceRank = (item: ContextEvidence, asOf: string) =>
  `${isFresh(item, asOf) ? "1" : "0"}:${item.confidence.toFixed(6)}:${item.collectedAt}`;
const isFresh = (item: ContextEvidence, asOf: string) =>
  Date.parse(item.collectedAt) + item.freshnessSeconds * 1_000 >=
  Date.parse(asOf);
const deriveUncertainty = (
  state: readonly CompanyStateInput[],
  evidence: readonly ContextEvidence[],
  asOf: string,
): readonly ContextUncertainty[] => {
  const result: ContextUncertainty[] = [];
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const missing = state
    .flatMap((item) => item.evidenceRefs)
    .filter((id) => !evidenceIds.has(id));
  if (missing.length > 0 || evidence.length === 0)
    result.push({
      type: "missing_evidence",
      sourceRefs: Object.freeze(missing),
    });
  const stale = evidence
    .filter((item) => !isFresh(item, asOf))
    .map((item) => item.id);
  const staleState = state
    .filter(
      (item) =>
        item.freshnessSeconds !== undefined &&
        Date.parse(item.observedAt) + item.freshnessSeconds * 1_000 <
          Date.parse(asOf),
    )
    .map((item) => item.id);
  if (stale.length > 0 || staleState.length > 0)
    result.push({
      type: "stale_evidence",
      sourceRefs: Object.freeze([...stale, ...staleState].sort()),
    });
  const conflicting = evidence
    .filter((item) =>
      item.conflictsWith?.some((other) => evidenceIds.has(other)),
    )
    .map((item) => item.id);
  if (conflicting.length > 0)
    result.push({
      type: "conflicting_evidence",
      sourceRefs: Object.freeze(conflicting.sort()),
    });
  return Object.freeze(result);
};
const sameCompany = (
  left: Pick<RunScope, "tenantId" | "companyId">,
  right: RunScope,
) => left.tenantId === right.tenantId && left.companyId === right.companyId;
const sameScope = (left: RunScope, right: RunScope) =>
  sameCompany(left, right) && left.agentId === right.agentId;
const assertScope = (scope: RunScope) => {
  if (!scope.tenantId || !scope.companyId || !scope.agentId)
    throw new Error("Context scope is incomplete");
};
const assertBudget = (budget: ContextBudget) => {
  if (
    !Number.isInteger(budget.maxSources) ||
    budget.maxSources < 1 ||
    !Number.isInteger(budget.maxChars) ||
    budget.maxChars < 1
  )
    throw new Error("Invalid context budget");
};
