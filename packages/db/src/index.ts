import {
  createCompanySchema,
  createMembershipSchema,
  createTenantSchema,
  evidenceSchema,
  organizationNodeSchema,
  provisionAgentSchema,
  stateObservationSchema,
  type CreateMembership,
} from "@nuknuk/api-contracts";
import type { AuthorityOutcome } from "@nuknuk/domain";

export type ServerActor = Readonly<{ id: string; type: "human" }>;

export type FoundationTransaction = Readonly<{
  bootstrapFounder: (
    input: Readonly<{
      tenantName: string;
      tenantSlug: string;
      companyName: string;
      companySlug: string;
      timezone: string;
      baseCurrency: string;
      actorId: string;
    }>,
  ) => Promise<string>;
  createCompany: (
    input: Readonly<{
      tenantId: string;
      name: string;
      slug: string;
      timezone: string;
      baseCurrency: string;
      actorId: string;
    }>,
  ) => Promise<string>;
  createMembership: (
    input: Readonly<CreateMembership & { actorId: string }>,
  ) => Promise<string>;
  createOrganizationNode: (
    input: Readonly<{
      tenantId: string;
      companyId: string;
      role: string;
      name: string;
      lifecycle: "draft" | "active" | "archived";
      actorId: string;
    }>,
  ) => Promise<string>;
  provisionAgent: (
    input: Readonly<{
      tenantId: string;
      companyId: string;
      organizationNodeId: string;
      charterVersionId: string;
      actorId: string;
    }>,
  ) => Promise<string>;
}>;

export type MembershipRoleAuthorizer = Readonly<{
  canAssign: (
    actor: ServerActor,
    membership: CreateMembership,
  ) => Promise<boolean>;
}>;

/**
 * Server-only persistence seam. Implementations call the service-role-restricted
 * SQL functions; agents never receive this capability or a Supabase role.
 */
export class FoundationService {
  constructor(
    private readonly transaction: FoundationTransaction,
    private readonly membershipRoleAuthorizer: MembershipRoleAuthorizer,
  ) {}

  async bootstrapFounder(
    actor: ServerActor,
    tenantInput: unknown,
    companyInput: unknown,
  ): Promise<string> {
    const tenant = createTenantSchema.parse(tenantInput);
    const company = createCompanySchema.parse(companyInput);
    return this.transaction.bootstrapFounder({
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      companyName: company.name,
      companySlug: company.slug,
      timezone: company.timezone,
      baseCurrency: company.baseCurrency,
      actorId: actor.id,
    });
  }

  async createCompany(actor: ServerActor, input: unknown): Promise<string> {
    const company = createCompanySchema.parse(input);
    return this.transaction.createCompany({ ...company, actorId: actor.id });
  }

  async createMembership(actor: ServerActor, input: unknown): Promise<string> {
    const membership = createMembershipSchema.parse(input);
    if (membership.role === "founder") {
      throw new Error("founder bootstrap is a separate server-authorized flow");
    }
    if (!(await this.membershipRoleAuthorizer.canAssign(actor, membership))) {
      throw new Error("membership role assignment denied");
    }
    return this.transaction.createMembership({
      ...membership,
      actorId: actor.id,
    });
  }

  async createOrganizationNode(
    actor: ServerActor,
    input: unknown,
  ): Promise<string> {
    const node = organizationNodeSchema.parse(input);
    return this.transaction.createOrganizationNode({
      tenantId: node.tenantId,
      companyId: node.companyId,
      role: node.role,
      name: node.name,
      lifecycle: node.lifecycle,
      actorId: actor.id,
    });
  }

  async provisionAgent(actor: ServerActor, input: unknown): Promise<string> {
    const agent = provisionAgentSchema.parse(input);
    return this.transaction.provisionAgent({
      tenantId: agent.tenantId,
      companyId: agent.companyId,
      organizationNodeId: agent.organizationNodeId,
      charterVersionId: agent.charterVersionId,
      actorId: actor.id,
    });
  }
}
export const databaseBoundary = "server-only" as const;

/** DB-owned persistence inputs; these are not browser/API transport entities. */
export type AgentRunPersistence = Readonly<{
  tenantId: string;
  companyId: string;
  agentId: string;
  runId: string;
  idempotencyKey: string;
  triggerRef: string;
}>;
export type AgentRunTransition = Readonly<{
  tenantId: string;
  companyId: string;
  agentId: string;
  runId: string;
  nextState:
    | "assembling_context"
    | "running"
    | "awaiting_authority"
    | "completed"
    | "failed"
    | "cancelled"
    | "timed_out"
    | "blocked";
  failureReason?: string;
  outputPointer?: string;
}>;
export type AuthorityEvaluation = Readonly<{
  outcome: AuthorityOutcome;
  ruleRefs: readonly string[];
}>;
export interface AuthorityEvaluator {
  evaluate(
    input: Readonly<{
      tenantId: string;
      companyId: string;
      subjectId: string;
      actionClass: string;
      resourceScope: string;
    }>,
  ): Promise<AuthorityEvaluation>;
}
export const failClosedAuthorityEvaluator: AuthorityEvaluator = {
  async evaluate() {
    return { outcome: "deny", ruleRefs: ["authority_data_unavailable"] };
  },
};
export type CompanyOSControlPlaneTransaction = Readonly<{
  reserveAgentRun: (
    input: AgentRunPersistence & { actorId: string },
  ) => Promise<Readonly<{ accepted: boolean; existingRunId: string }>>;
  transitionAgentRun: (
    input: AgentRunTransition & { actorId: string },
  ) => Promise<void>;
  recordEvidence: (
    input: Readonly<{
      tenantId: string;
      companyId: string;
      type: string;
      source: string;
      contentPointer: string;
      collectedAt: string;
      confidence: number;
      classification: string;
      actorId: string;
    }>,
  ) => Promise<string>;
  recordStateObservation: (
    input: Readonly<{
      tenantId: string;
      companyId: string;
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
    }>,
  ) => Promise<string>;
}>;
/** Runtime calls this service boundary; it never receives a database writer. */
export class CompanyOSControlPlaneService {
  constructor(private readonly transaction: CompanyOSControlPlaneTransaction) {}

  reserveAgentRun(actor: ServerActor, input: AgentRunPersistence) {
    return this.transaction.reserveAgentRun({ ...input, actorId: actor.id });
  }
  transitionAgentRun(actor: ServerActor, input: AgentRunTransition) {
    return this.transaction.transitionAgentRun({ ...input, actorId: actor.id });
  }
  recordEvidence(actor: ServerActor, input: unknown) {
    const evidence = evidenceSchema.parse(input);
    return this.transaction.recordEvidence({ ...evidence, actorId: actor.id });
  }
  recordStateObservation(actor: ServerActor, input: unknown) {
    const observation = stateObservationSchema.parse(input);
    const { id: _id, evidenceId, ...state } = observation;
    return this.transaction.recordStateObservation({
      ...state,
      ...(evidenceId === undefined ? {} : { evidenceId }),
      ownerId: actor.id,
      actorId: actor.id,
    });
  }
}
