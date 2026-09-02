import {
  agentDetailViewSchema,
  awaitingAuthorityViewSchema,
  companyStateCardViewSchema,
  createAgentCharterVersionSchema,
  createMembershipSchema,
  createObjectiveSchema,
  createOrganizationNodeSchema,
  createCompanySchema,
  createTenantSchema,
  integrationConnectionViewSchema,
  objectiveViewSchema,
  organizationGraphViewSchema,
  provisionAgentSchema,
  type AgentDetailView,
  type AwaitingAuthorityView,
  type CompanyStateCardView,
  type CreateAgentCharterVersion,
  type CreateMembership,
  type CreateObjective,
  type CreateOrganizationNode,
  type IntegrationConnectionView,
  type ObjectiveView,
  type OrganizationGraphView,
  type ProvisionAgent,
} from "@nuknuk/api-contracts";
import type {
  FounderBootstrapInput,
  ProductService,
  ProductSnapshot,
} from "./index.ts";

export type ProductApiContext = Readonly<{
  tenantId: string;
  company: Readonly<{
    id: string;
    name: string;
    timezone: string;
    baseCurrency: string;
  }>;
}>;

/** Routes are supplied by Dev A's server boundary; this client owns no DB knowledge. */
export type ProductApiRoutes = Readonly<{
  bootstrapFounder: string;
  memberships: string;
  organizationGraph: string;
  organizationNodes: string;
  agentCharterVersions: string;
  agents: string;
  agentDetail: (agentId: string) => string;
  companyStateCards: string;
  objectives: string;
  awaitingAuthority: string;
  integrations: string;
}>;

export interface ProductApiTransport {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown, idempotencyKey: string): Promise<unknown>;
}

export class ProductApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const idempotencyKey = (): string =>
  `ui_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown): T =>
  schema.parse(value);

const requireScope = <T extends { tenantId: string; companyId: string }>(
  value: T,
  scope: Readonly<{ tenantId: string; companyId: string }>,
): T => {
  if (value.tenantId !== scope.tenantId || value.companyId !== scope.companyId)
    throw new ProductApiError(
      "Server response is outside the requested tenant scope",
      502,
    );
  return value;
};

/**
 * Production-oriented adapter. It validates every server response at the
 * ProductService boundary and has no Supabase dependency or privileged state.
 */
export class ApiProductService implements ProductService {
  constructor(
    private readonly transport: ProductApiTransport,
    private readonly routes: ProductApiRoutes,
    private readonly context: ProductApiContext,
  ) {}

  async getOrganizationGraph(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<OrganizationGraphView> {
    return requireScope(
      parse(
        organizationGraphViewSchema,
        await this.transport.get(this.routes.organizationGraph),
      ),
      scope,
    );
  }

  async getAgentDetail(
    scope: Readonly<{ tenantId: string; companyId: string; agentId: string }>,
  ): Promise<AgentDetailView> {
    return requireScope(
      parse(
        agentDetailViewSchema,
        await this.transport.get(this.routes.agentDetail(scope.agentId)),
      ),
      scope,
    );
  }

  async getCompanyStateCards(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly CompanyStateCardView[]> {
    const response = await this.transport.get(this.routes.companyStateCards);
    return parse(companyStateCardViewSchema.array(), response).map((view) =>
      requireScope(view, scope),
    );
  }

  async listObjectives(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly ObjectiveView[]> {
    return parse(
      objectiveViewSchema.array(),
      await this.transport.get(this.routes.objectives),
    ).map((view) => requireScope(view, scope));
  }

  async listAwaitingAuthority(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly AwaitingAuthorityView[]> {
    return parse(
      awaitingAuthorityViewSchema.array(),
      await this.transport.get(this.routes.awaitingAuthority),
    ).map((view) => requireScope(view, scope));
  }

  async listIntegrationConnections(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly IntegrationConnectionView[]> {
    return parse(
      integrationConnectionViewSchema.array(),
      await this.transport.get(this.routes.integrations),
    ).map((view) => requireScope(view, scope));
  }

  async bootstrapFounder(input: FounderBootstrapInput): Promise<void> {
    createTenantSchema.parse(input.tenant);
    createCompanySchema.parse({
      ...input.company,
      tenantId: "server_assigned",
    });
    await this.transport.post(
      this.routes.bootstrapFounder,
      input,
      idempotencyKey(),
    );
  }

  async createMembership(input: CreateMembership): Promise<void> {
    await this.transport.post(
      this.routes.memberships,
      createMembershipSchema.parse(input),
      idempotencyKey(),
    );
  }

  async createOrganizationNode(input: CreateOrganizationNode): Promise<void> {
    await this.transport.post(
      this.routes.organizationNodes,
      createOrganizationNodeSchema.parse(input),
      idempotencyKey(),
    );
  }

  async createAgentCharterVersion(
    input: CreateAgentCharterVersion,
  ): Promise<void> {
    await this.transport.post(
      this.routes.agentCharterVersions,
      createAgentCharterVersionSchema.parse(input),
      idempotencyKey(),
    );
  }

  async provisionAgent(input: ProvisionAgent): Promise<void> {
    await this.transport.post(
      this.routes.agents,
      provisionAgentSchema.parse(input),
      idempotencyKey(),
    );
  }

  async createObjective(input: CreateObjective): Promise<void> {
    await this.transport.post(
      this.routes.objectives,
      createObjectiveSchema.parse(input),
      idempotencyKey(),
    );
  }

  async getSnapshot(): Promise<ProductSnapshot> {
    const scope = {
      tenantId: this.context.tenantId,
      companyId: this.context.company.id,
    };
    const [graph, stateCards, objectives, attention, integrations] =
      await Promise.all([
        this.getOrganizationGraph(scope),
        this.getCompanyStateCards(scope),
        this.listObjectives(scope),
        this.listAwaitingAuthority(scope),
        this.listIntegrationConnections(scope),
      ]);
    const agents = await Promise.all(
      graph.nodes.flatMap((node) =>
        node.agents.map((agent) =>
          this.getAgentDetail({ ...scope, agentId: agent.id }),
        ),
      ),
    );
    return {
      tenantId: scope.tenantId,
      company: this.context.company,
      organizationNodes: graph.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        role: node.role,
        lifecycle: node.lifecycle,
        ...(node.reportsToOrganizationNodeId
          ? { reportsTo: node.reportsToOrganizationNodeId }
          : {}),
      })),
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        organizationNodeId: agent.organizationNodeId,
        status: agent.status,
        charter: {
          versionId: agent.charter.id,
          version: agent.charter.version,
          mission: agent.charter.mission,
          responsibilities: agent.charter.responsibilities,
          allowedDataCapabilities: agent.charter.allowedDataCapabilities,
          allowedToolCapabilities: agent.charter.allowedToolCapabilities,
        },
        authoritySummary: agent.authoritySummary,
        currentWorkSummary: agent.currentWorkSummary,
        costSummary: agent.costSummary,
      })),
      stateCards: stateCards.map((card) => ({
        id: card.id,
        label: card.label,
        value: card.displayValue,
        source: card.source,
        observedAt: card.observedAt ?? "Not observed",
        freshness: card.freshness,
        confidence: card.confidence,
      })),
      objectives: objectives.map((objective) => ({
        id: objective.id,
        title: objective.title,
        description: objective.description,
        status: objective.status,
        owner: objective.ownerLabel,
      })),
      integrations: integrations.map((integration) => ({
        id: integration.id,
        name: integration.name,
        capability: integration.capabilities.join(", "),
        scope: integration.scopeSummary,
        health:
          integration.health === "active"
            ? "healthy"
            : integration.health === "pending_verification" ||
                integration.health === "revoked"
              ? "not_configured"
              : integration.health,
      })),
      founderAttention: attention.map((view) => ({
        state: view.state,
        output: view.output,
      })),
    };
  }
}
