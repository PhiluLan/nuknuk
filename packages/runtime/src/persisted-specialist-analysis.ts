import type { AgentRunExecutor, QueuedRun, RunResult } from "./index.ts";
import { ContextBuilder, type ContextBuildInput } from "./context-builder.ts";
import type {
  AgentRunApplicationService,
  CompanyIntelligenceContextService,
} from "./application-boundary.ts";

export class PersistedSpecialistAnalysisFlow {
  constructor(
    private readonly contextService: CompanyIntelligenceContextService,
    private readonly contextBuilder: ContextBuilder,
    private readonly executor: AgentRunExecutor,
    private readonly applicationService: AgentRunApplicationService,
  ) {}

  async run(
    input: Readonly<{
      queuedRun: Omit<QueuedRun, "manifest" | "context">;
      scope: ContextBuildInput["scope"];
      triggerRef: string;
    }>,
  ): Promise<RunResult> {
    const reservation = await this.applicationService.reserveRun({
      scope: input.scope,
      runId: input.queuedRun.id,
      idempotencyKey: input.queuedRun.idempotencyKey,
      triggerRef: input.triggerRef,
    });
    if (!reservation.accepted)
      return failedResult(
        input.queuedRun.id,
        input.scope,
        "blocked",
        "duplicate:" + reservation.existingRunId,
      );
    try {
      const contextInput = await this.contextService.loadContext({
        scope: input.scope,
        runId: input.queuedRun.id,
        triggerRef: input.triggerRef,
      });
      if (
        contextInput.runId !== input.queuedRun.id ||
        contextInput.triggerRef !== input.triggerRef ||
        !sameScope(contextInput.scope, input.scope)
      )
        throw new Error("Control Plane context identity mismatch");
      await this.applicationService.transitionRun({
        scope: contextInput.scope,
        runId: input.queuedRun.id,
        state: "assembling_context",
      });
      const context = await this.contextBuilder.build(contextInput);
      const stored = await this.applicationService.persistContextManifest({
        scope: contextInput.scope,
        runId: input.queuedRun.id,
        manifest: context.manifest,
      });
      await this.applicationService.transitionRun({
        scope: contextInput.scope,
        runId: input.queuedRun.id,
        state: "running",
        contextManifestRef: stored.manifestRef,
      });
      const result = await this.executor.execute({
        ...input.queuedRun,
        manifest: context.manifest,
        context,
      });
      if (result.usage)
        await this.applicationService.recordUsage({
          scope: input.scope,
          runId: result.runId,
          ...result.usage,
        });
      await this.applicationService.transitionRun({
        scope: contextInput.scope,
        runId: result.runId,
        state: result.state,
        contextManifestRef: stored.manifestRef,
        ...(result.failureReason
          ? { failureReason: result.failureReason }
          : {}),
      });
      return result;
    } catch (error) {
      return failedResult(
        input.queuedRun.id,
        input.scope,
        "failed",
        `persistence_handoff_failed:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }
}

const sameScope = (
  left: ContextBuildInput["scope"],
  right: ContextBuildInput["scope"],
) =>
  left.tenantId === right.tenantId &&
  left.companyId === right.companyId &&
  left.agentId === right.agentId;
const failedResult = (
  runId: string,
  scope: ContextBuildInput["scope"],
  state: "failed" | "blocked",
  failureReason: string,
): RunResult => ({
  runId,
  state,
  trace: [{ state, reason: failureReason }],
  manifest: {
    runId,
    scope,
    triggerRef: "control_plane_handoff",
    charterVersion: 1,
    evidence_refs: [],
  },
  failureReason,
  costCents: 0,
});
