import type { RunContextManifest, RunResult, RunScope } from "./index.ts";
import type { ContextBuildInput } from "./context-builder.ts";

/**
 * Application-facing mirror of Dev A's reviewed control-plane handoff.
 * Implementations belong to the server application layer, never to runtime or DB packages.
 */
export interface AgentRunApplicationService {
  reserveRun(
    input: Readonly<{
      scope: RunScope;
      runId: string;
      idempotencyKey: string;
      triggerRef: string;
    }>,
  ): Promise<Readonly<{ accepted: boolean; existingRunId: string }>>;
  persistContextManifest(
    input: Readonly<{
      scope: RunScope;
      runId: string;
      manifest: RunContextManifest;
    }>,
  ): Promise<Readonly<{ manifestRef: string }>>;
  transitionRun(
    input: Readonly<{
      scope: RunScope;
      runId: string;
      state: RunResult["state"];
      contextManifestRef?: string;
      failureReason?: string;
    }>,
  ): Promise<void>;
  recordUsage(
    input: Readonly<{
      scope: RunScope;
      runId: string;
      inputTokens: number;
      outputTokens: number;
      estimatedCostCents: number;
    }>,
  ): Promise<void>;
}

/** Data read boundary: implementations apply Control Plane scopes before returning context. */
export interface CompanyIntelligenceContextService {
  loadContext(
    input: Readonly<{ scope: RunScope; runId: string; triggerRef: string }>,
  ): Promise<ContextBuildInput>;
}

export const isAcceptedRun = (result: RunResult) =>
  result.state === "awaiting_authority";
