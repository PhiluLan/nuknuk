import type { AgentRuntimeOutput } from "@nuknuk/api-contracts";
import type { AgentRunExecutor, QueuedRun, RunResult } from "./index.ts";
import {
  ContextBuilder,
  type AssembledRunContext,
  type ContextBuildInput,
} from "./context-builder.ts";

export type SpecialistAnalysisRequest = Readonly<{
  queuedRun: Omit<QueuedRun, "manifest">;
  context: ContextBuildInput;
}>;
export type SpecialistAnalysisResult = Readonly<{
  context: AssembledRunContext;
  run: RunResult;
  proposal?: AgentRuntimeOutput;
}>;

/** Structured composition only; this does not create agent-to-agent chat or invoke side effects. */
export class SpecialistAnalysisFlow {
  constructor(
    private readonly contextBuilder: ContextBuilder,
    private readonly executor: AgentRunExecutor,
  ) {}
  async run(
    request: SpecialistAnalysisRequest,
  ): Promise<SpecialistAnalysisResult> {
    if (request.queuedRun.id !== request.context.runId)
      throw new Error("Run and context identifiers must match");
    const context = await this.contextBuilder.build(request.context);
    const run = await this.executor.execute({
      ...request.queuedRun,
      manifest: context.manifest,
      context,
    });
    return Object.freeze({
      context,
      run,
      ...(run.output ? { proposal: run.output } : {}),
    });
  }
}
