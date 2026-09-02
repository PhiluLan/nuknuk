import {
  agentDetailViewSchema,
  agentRuntimeOutputSchema,
  awaitingAuthorityViewSchema,
  companyStateCardViewSchema,
  createAgentCharterVersionSchema,
  createObjectiveSchema,
  evidenceSchema,
  integrationConnectionViewSchema,
  objectiveViewSchema,
  organizationGraphViewSchema,
  stateObservationSchema,
  type AgentRuntimeOutput,
} from "@nuknuk/api-contracts";
import type { FoundationTransaction, ServerActor } from "./index.ts";

export type Scope = Readonly<{ tenantId: string; companyId: string }>;
export type IdempotentInput = Readonly<{ idempotencyKey: string }>;

export class ControlPlaneProblem extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422,
    readonly type: string,
    readonly title: string,
    detail: string,
  ) {
    super(detail);
  }

  toJson() {
    return {
      type: `https://nuknuk.dev/problems/${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.message,
    } as const;
  }
}

export const asProblem = (error: unknown): ControlPlaneProblem => {
  if (error instanceof ControlPlaneProblem) return error;
  if (error instanceof Error && error.name === "ZodError") {
    return new ControlPlaneProblem(
      422,
      "invalid-request",
      "Request validation failed",
      error.message,
    );
  }
  return new ControlPlaneProblem(
    409,
    "control-plane-conflict",
    "Control Plane operation was rejected",
    error instanceof Error ? error.message : "Unknown control-plane error",
  );
};

const requireIdempotencyKey = (value: string | undefined): string => {
  if (value === undefined || value.length < 8 || value.length > 256) {
    throw new ControlPlaneProblem(
      422,
      "idempotency-key-required",
      "A valid Idempotency-Key is required",
      "Mutations must include an idempotency key between 8 and 256 characters.",
    );
  }
  return value;
};

const assertScope = (
  requested: Scope,
  received: Readonly<{ tenantId: string; companyId: string }>,
): void => {
  if (
    requested.tenantId !== received.tenantId ||
    requested.companyId !== received.companyId
  ) {
    throw new ControlPlaneProblem(
      403,
      "tenant-scope-mismatch",
      "Projection is outside the authorized scope",
      "The persistence adapter returned data outside the requested tenant/company scope.",
    );
  }
};

export type AgentRunState =
  | "queued"
  | "assembling_context"
  | "running"
  | "awaiting_authority"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "blocked";

export type AgentRunInput = Scope &
  Readonly<{
    agentId: string;
    runId: string;
    triggerRef: string;
    idempotencyKey: string;
  }>;

export type AgentRunTransitionInput = Scope &
  Readonly<{
    agentId: string;
    runId: string;
    nextState: Exclude<AgentRunState, "queued">;
    failureReason?: string;
    outputPointer?: string;
  }>;

export type UsageInput = Scope &
  Readonly<{
    agentId: string;
    runId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostCents: number;
  }>;

/**
 * This is implemented by a server-only RPC adapter. Runtime and browser code
 * receive this interface, never a database client or Supabase service key.
 */
export type ControlPlaneStore = Readonly<{
  createAgentCharterVersion: (
    input: Scope &
      Readonly<{
        organizationNodeId: string;
        mission: string;
        responsibilities: readonly string[];
        allowedDataCapabilities: readonly string[];
        allowedToolCapabilities: readonly string[];
        actorId: string;
        idempotencyKey: string;
      }>,
  ) => Promise<string>;
  createObjective: (
    input: Scope &
      Readonly<{
        title: string;
        description: string;
        ownerOrganizationNodeId?: string;
        actorId: string;
        idempotencyKey: string;
      }>,
  ) => Promise<string>;
  recordEvidence: (
    input: Scope &
      Readonly<{
        type: string;
        source: string;
        contentPointer: string;
        collectedAt: string;
        confidence: number;
        classification: string;
        actorId: string;
        idempotencyKey: string;
      }>,
  ) => Promise<string>;
  recordStateObservation: (
    input: Scope &
      Readonly<{
        metricKey: string;
        value: unknown;
        unit: string;
        observedAt: string;
        ingestedAt: string;
        evidenceId?: string;
        freshnessSeconds: number;
        confidence: number;
        ownerId: string;
        actorId: string;
        idempotencyKey: string;
      }>,
  ) => Promise<string>;
  reserveAgentRun: (
    input: AgentRunInput & Readonly<{ actorId: string }>,
  ) => Promise<Readonly<{ accepted: boolean; existingRunId: string }>>;
  transitionAgentRun: (
    input: AgentRunTransitionInput & Readonly<{ actorId: string }>,
  ) => Promise<void>;
  attachRunContextManifest: (
    input: Scope &
      Readonly<{
        agentId: string;
        runId: string;
        manifestPointer: string;
        manifestHash: string;
        evidenceRefs: readonly string[];
        actorId: string;
      }>,
  ) => Promise<string>;
  recordUsage: (
    input: UsageInput & Readonly<{ actorId: string }>,
  ) => Promise<string>;
  persistAwaitingAuthorityOutput: (
    input: Scope &
      Readonly<{
        agentId: string;
        runId: string;
        output: AgentRuntimeOutput;
        outputPointer: string;
        actorId: string;
      }>,
  ) => Promise<void>;
  organizationGraph: (
    scope: Scope & Readonly<{ actorId: string }>,
  ) => Promise<unknown>;
  agentDetail: (
    scope: Scope & Readonly<{ agentId: string; actorId: string }>,
  ) => Promise<unknown>;
  companyStateCards: (
    scope: Scope & Readonly<{ actorId: string }>,
  ) => Promise<readonly unknown[]>;
  objectives: (
    scope: Scope & Readonly<{ actorId: string }>,
  ) => Promise<readonly unknown[]>;
  awaitingAuthority: (
    scope: Scope & Readonly<{ actorId: string }>,
  ) => Promise<readonly unknown[]>;
}>;

/** Implement this once with the server-only Supabase RPC client in the host app. */
export type ServerRpcClient = Readonly<{
  call: <T>(
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<T>;
}>;

const asId = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("server RPC returned an invalid resource identifier");
  }
  return value;
};

export const createFoundationRpcTransaction = (
  rpc: ServerRpcClient,
): FoundationTransaction => ({
  bootstrapFounder: async (input) => {
    const result = await rpc.call<Readonly<{ tenant_id: unknown }>>(
      "app.create_tenant_with_founder",
      {
        p_slug: input.tenantSlug,
        p_tenant_name: input.tenantName,
        p_company_name: input.companyName,
        p_company_slug: input.companySlug,
        p_founder_user_id: input.actorId,
        p_timezone: input.timezone,
        p_base_currency: input.baseCurrency,
      },
    );
    return asId(result.tenant_id);
  },
  createCompany: (input) =>
    rpc
      .call<unknown>("app.create_company", {
        p_tenant_id: input.tenantId,
        p_name: input.name,
        p_slug: input.slug,
        p_timezone: input.timezone,
        p_base_currency: input.baseCurrency,
        p_actor_id: input.actorId,
      })
      .then(asId),
  createMembership: (input) =>
    rpc
      .call<unknown>("app.create_membership", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_user_id: input.userId,
        p_role: input.role,
        p_actor_id: input.actorId,
      })
      .then(asId),
  createOrganizationNode: (input) =>
    rpc
      .call<unknown>("app.create_organization_node", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_role: input.role,
        p_name: input.name,
        p_lifecycle: input.lifecycle,
        p_reports_to_node_id: input.reportsToOrganizationNodeId ?? null,
        p_actor_id: input.actorId,
      })
      .then(asId),
  provisionAgent: (input) =>
    rpc
      .call<unknown>("app.provision_agent", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_organization_node_id: input.organizationNodeId,
        p_charter_version_id: input.charterVersionId,
        p_actor_id: input.actorId,
      })
      .then(asId),
});

export const createControlPlaneRpcStore = (
  rpc: ServerRpcClient,
): ControlPlaneStore => ({
  createAgentCharterVersion: (input) =>
    rpc
      .call<unknown>("app.create_agent_charter_version", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_organization_node_id: input.organizationNodeId,
        p_mission: input.mission,
        p_responsibilities: input.responsibilities,
        p_allowed_data_capabilities: input.allowedDataCapabilities,
        p_allowed_tool_capabilities: input.allowedToolCapabilities,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
      })
      .then(asId),
  createObjective: (input) =>
    rpc
      .call<unknown>("app.create_objective", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_title: input.title,
        p_description: input.description,
        p_owner_organization_node_id: input.ownerOrganizationNodeId ?? null,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
      })
      .then(asId),
  recordEvidence: (input) =>
    rpc
      .call<unknown>("app.record_evidence", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_evidence_type: input.type,
        p_source: input.source,
        p_content_pointer: input.contentPointer,
        p_collected_at: input.collectedAt,
        p_confidence: input.confidence,
        p_classification: input.classification,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
      })
      .then(asId),
  recordStateObservation: (input) =>
    rpc
      .call<unknown>("app.record_state_observation", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_metric_key: input.metricKey,
        p_value: input.value,
        p_unit: input.unit,
        p_observed_at: input.observedAt,
        p_ingested_at: input.ingestedAt,
        p_evidence_id: input.evidenceId ?? null,
        p_freshness_seconds: input.freshnessSeconds,
        p_confidence: input.confidence,
        p_owner_id: input.ownerId,
        p_actor_id: input.actorId,
        p_idempotency_key: input.idempotencyKey,
      })
      .then(asId),
  reserveAgentRun: (input) =>
    rpc
      .call<Readonly<{ accepted: boolean; existing_run_id: unknown }>>(
        "app.reserve_agent_run",
        {
          p_tenant_id: input.tenantId,
          p_company_id: input.companyId,
          p_agent_id: input.agentId,
          p_run_id: input.runId,
          p_idempotency_key: input.idempotencyKey,
          p_trigger_ref: input.triggerRef,
          p_actor_id: input.actorId,
        },
      )
      .then((result) => ({
        accepted: result.accepted,
        existingRunId: asId(result.existing_run_id),
      })),
  transitionAgentRun: async (input) => {
    await rpc.call("app.persist_agent_run_transition", {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_agent_id: input.agentId,
      p_run_id: input.runId,
      p_next_state: input.nextState,
      p_failure_reason: input.failureReason ?? null,
      p_output_pointer: input.outputPointer ?? null,
      p_actor_id: input.actorId,
    });
  },
  attachRunContextManifest: (input) =>
    rpc
      .call<unknown>("app.attach_run_context_manifest", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_agent_id: input.agentId,
        p_run_id: input.runId,
        p_manifest_pointer: input.manifestPointer,
        p_manifest_hash: input.manifestHash,
        p_evidence_refs: input.evidenceRefs,
        p_actor_id: input.actorId,
      })
      .then(asId),
  recordUsage: (input) =>
    rpc
      .call<unknown>("app.record_usage", {
        p_tenant_id: input.tenantId,
        p_company_id: input.companyId,
        p_agent_id: input.agentId,
        p_run_id: input.runId,
        p_provider: input.provider,
        p_model: input.model,
        p_input_tokens: input.inputTokens,
        p_output_tokens: input.outputTokens,
        p_estimated_cost_cents: input.estimatedCostCents,
        p_actor_id: input.actorId,
      })
      .then(asId),
  persistAwaitingAuthorityOutput: async (input) => {
    await rpc.call("app.persist_awaiting_authority_output", {
      p_tenant_id: input.tenantId,
      p_company_id: input.companyId,
      p_agent_id: input.agentId,
      p_run_id: input.runId,
      p_runtime_output: input.output,
      p_output_pointer: input.outputPointer,
      p_actor_id: input.actorId,
    });
  },
  organizationGraph: (scope) =>
    rpc.call("app.read_organization_graph", {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_actor_id: scope.actorId,
    }),
  agentDetail: (scope) =>
    rpc.call("app.read_agent_detail", {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_agent_id: scope.agentId,
      p_actor_id: scope.actorId,
    }),
  companyStateCards: (scope) =>
    rpc.call<readonly unknown[]>("app.read_company_state_cards", {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_actor_id: scope.actorId,
    }),
  objectives: (scope) =>
    rpc.call<readonly unknown[]>("app.read_objectives", {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_actor_id: scope.actorId,
    }),
  awaitingAuthority: (scope) =>
    rpc.call<readonly unknown[]>("app.read_awaiting_authority", {
      p_tenant_id: scope.tenantId,
      p_company_id: scope.companyId,
      p_actor_id: scope.actorId,
    }),
});

export class ControlPlaneService {
  constructor(private readonly store: ControlPlaneStore) {}

  async createAgentCharterVersion(
    actor: ServerActor,
    input: unknown,
    idempotencyKey: string | undefined,
  ) {
    const charter = createAgentCharterVersionSchema.parse(input);
    return this.store.createAgentCharterVersion({
      ...charter,
      actorId: actor.id,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  async createObjective(
    actor: ServerActor,
    input: unknown,
    idempotencyKey: string | undefined,
  ) {
    const { ownerOrganizationNodeId, ...objective } =
      createObjectiveSchema.parse(input);
    return this.store.createObjective({
      ...objective,
      ...(ownerOrganizationNodeId === undefined
        ? {}
        : { ownerOrganizationNodeId }),
      actorId: actor.id,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  async recordEvidence(
    actor: ServerActor,
    input: unknown,
    idempotencyKey: string | undefined,
  ) {
    const { id: _id, ...evidence } = evidenceSchema.parse(input);
    return this.store.recordEvidence({
      ...evidence,
      actorId: actor.id,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  async recordStateObservation(
    actor: ServerActor,
    input: unknown,
    idempotencyKey: string | undefined,
  ) {
    const {
      id: _id,
      evidenceId,
      ...observation
    } = stateObservationSchema.parse(input);
    return this.store.recordStateObservation({
      ...observation,
      ...(evidenceId === undefined ? {} : { evidenceId }),
      ownerId: actor.id,
      actorId: actor.id,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
    });
  }

  reserveAgentRun(actor: ServerActor, input: AgentRunInput) {
    requireIdempotencyKey(input.idempotencyKey);
    return this.store.reserveAgentRun({ ...input, actorId: actor.id });
  }

  transitionAgentRun(actor: ServerActor, input: AgentRunTransitionInput) {
    return this.store.transitionAgentRun({ ...input, actorId: actor.id });
  }

  attachRunContextManifest(
    actor: ServerActor,
    input: Omit<
      Parameters<ControlPlaneStore["attachRunContextManifest"]>[0],
      "actorId"
    >,
  ) {
    return this.store.attachRunContextManifest({ ...input, actorId: actor.id });
  }

  recordUsage(actor: ServerActor, input: UsageInput) {
    return this.store.recordUsage({ ...input, actorId: actor.id });
  }

  persistAwaitingAuthorityOutput(
    actor: ServerActor,
    input: Scope &
      Readonly<{
        agentId: string;
        runId: string;
        output: unknown;
        outputPointer: string;
      }>,
  ) {
    const output = agentRuntimeOutputSchema.parse(input.output);
    if (
      output.run_id !== input.runId ||
      output.tenant_id !== input.tenantId ||
      output.company_id !== input.companyId ||
      output.agent_id !== input.agentId
    ) {
      throw new ControlPlaneProblem(
        403,
        "run-scope-mismatch",
        "Runtime output is outside the reserved run scope",
        "The output scope must exactly match the reserved AgentRun.",
      );
    }
    return this.store.persistAwaitingAuthorityOutput({
      ...input,
      output,
      actorId: actor.id,
    });
  }

  async organizationGraph(actor: ServerActor, scope: Scope) {
    const view = organizationGraphViewSchema.parse(
      await this.store.organizationGraph({ ...scope, actorId: actor.id }),
    );
    assertScope(scope, view);
    return view;
  }

  async agentDetail(
    actor: ServerActor,
    scope: Scope & Readonly<{ agentId: string }>,
  ) {
    const view = agentDetailViewSchema.parse(
      await this.store.agentDetail({ ...scope, actorId: actor.id }),
    );
    assertScope(scope, view);
    if (view.id !== scope.agentId) {
      throw new ControlPlaneProblem(
        403,
        "agent-scope-mismatch",
        "Agent detail is outside the authorized scope",
        "The persistence adapter returned a different agent.",
      );
    }
    return view;
  }

  async companyStateCards(actor: ServerActor, scope: Scope) {
    return (
      await this.store.companyStateCards({ ...scope, actorId: actor.id })
    ).map((card) => {
      const view = companyStateCardViewSchema.parse(card);
      assertScope(scope, view);
      return view;
    });
  }

  async objectives(actor: ServerActor, scope: Scope) {
    return (await this.store.objectives({ ...scope, actorId: actor.id })).map(
      (objective) => {
        const view = objectiveViewSchema.parse(objective);
        assertScope(scope, view);
        return view;
      },
    );
  }

  async awaitingAuthority(actor: ServerActor, scope: Scope) {
    return (
      await this.store.awaitingAuthority({ ...scope, actorId: actor.id })
    ).map((candidate) => {
      const view = awaitingAuthorityViewSchema.parse(candidate);
      assertScope(scope, view);
      return view;
    });
  }

  /** No adapter is installed yet: return only this presentation-safe seam. */
  integrationConnectionView(scope: Scope) {
    return integrationConnectionViewSchema.parse({
      ...scope,
      id: "integration-not-configured",
      name: "No integration configured",
      capabilities: [],
      scopeSummary: "No integration connection is available.",
      health: "not_configured",
      connectionFlow: "server_initiated",
    });
  }
}

export type ControlPlaneHttpRequest = Readonly<{
  actor?: ServerActor;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  headers: Readonly<Record<string, string | undefined>>;
}>;
export type ControlPlaneHttpResponse = Readonly<{
  status: number;
  body: unknown;
  contentType: "application/json" | "application/problem+json";
}>;

/** Framework-neutral adapter for the mature, narrow mutation surface only. */
export const handleControlPlaneRequest = async (
  service: ControlPlaneService,
  request: ControlPlaneHttpRequest,
): Promise<ControlPlaneHttpResponse> => {
  try {
    if (request.actor === undefined) {
      throw new ControlPlaneProblem(
        401,
        "authentication-required",
        "Authentication is required",
        "A verified human server session is required.",
      );
    }
    const idempotencyKey = request.headers["idempotency-key"];
    if (request.method === "POST" && request.path === "/api/v1/objectives") {
      return {
        status: 201,
        body: {
          id: await service.createObjective(
            request.actor,
            request.body,
            idempotencyKey,
          ),
        },
        contentType: "application/json",
      };
    }
    if (request.method === "POST" && request.path === "/api/v1/evidence") {
      return {
        status: 201,
        body: {
          id: await service.recordEvidence(
            request.actor,
            request.body,
            idempotencyKey,
          ),
        },
        contentType: "application/json",
      };
    }
    if (
      request.method === "POST" &&
      request.path === "/api/v1/state-observations"
    ) {
      return {
        status: 201,
        body: {
          id: await service.recordStateObservation(
            request.actor,
            request.body,
            idempotencyKey,
          ),
        },
        contentType: "application/json",
      };
    }
    throw new ControlPlaneProblem(
      404,
      "not-found",
      "Route not found",
      "No Control Plane handler exists for this route.",
    );
  } catch (error) {
    const problem = asProblem(error);
    return {
      status: problem.status,
      body: problem.toJson(),
      contentType: "application/problem+json",
    };
  }
};
