import { z } from "zod";

export const opaqueId = z.string().min(1).max(128);
export const isoDateTime = z.string().datetime({ offset: true });
export const tenantScopeSchema = z.object({
  tenantId: opaqueId,
  companyId: opaqueId,
});
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }, "targetDate must be a real ISO-8601 calendar date");
export const membershipRoleSchema = z.enum([
  "founder",
  "admin",
  "operator",
  "viewer",
]);

/** Canonical transport inputs; persistence metadata is server-owned. */
export const createTenantSchema = z
  .object({
    name: z.string().min(1).max(256),
    slug: slugSchema,
  })
  .strict();

export const createCompanySchema = z
  .object({
    tenantId: opaqueId,
    name: z.string().min(1).max(256),
    slug: slugSchema,
    timezone: z.string().min(1).max(64),
    baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  })
  .strict();

export const createMembershipSchema = z
  .object({
    tenantId: opaqueId,
    companyId: opaqueId,
    userId: opaqueId,
    role: membershipRoleSchema,
  })
  .strict();

export const provisionAgentSchema = z
  .object({
    tenantId: opaqueId,
    companyId: opaqueId,
    organizationNodeId: opaqueId,
    charterVersionId: opaqueId,
  })
  .strict();

export const organizationNodeSchema = tenantScopeSchema.extend({
  id: opaqueId.optional(),
  role: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  lifecycle: z.enum(["draft", "active", "archived"]).default("draft"),
});

export const agentCharterSchema = tenantScopeSchema.extend({
  id: opaqueId.optional(),
  organizationNodeId: opaqueId,
  version: z.number().int().positive(),
  mission: z.string().min(1),
  responsibilities: z.array(z.string()).default([]),
  forbiddenActions: z.array(z.string()).default([]),
  authorityLevel: z.enum(["L0", "L1", "L2", "L3", "L4", "human_only"]),
});

export const evidenceTypeSchema = z.enum([
  "verified_system_data",
  "human_input",
  "external_source",
  "agent_inference",
  "insufficient_evidence",
]);
export const evidenceClassificationSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export const contentHashSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();
const sourceVersionRefSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine(
    (value) =>
      !/(?:password|secret|api[_-]?key|access[_-]?token|bearer\s|:\/\/[^/\s:@]+:[^@\s]+@)/i.test(
        value,
      ),
    "sourceVersionRef must not contain credential-shaped data",
  );

export const evidenceSchema = tenantScopeSchema.extend({
  id: opaqueId.optional(),
  type: evidenceTypeSchema,
  source: z.string().min(1),
  collectedAt: isoDateTime,
  confidence: z.number().min(0).max(1),
  contentPointer: z.string().min(1),
  classification: evidenceClassificationSchema.default("internal"),
});

/** CTO Decision 005: client transport only; trust-class elevation is server-governed. */
export const recordEvidenceSchema = tenantScopeSchema
  .extend({
    type: evidenceTypeSchema,
    source: z.string().min(1),
    contentPointer: z.string().min(1),
    collectedAt: isoDateTime,
    confidence: z.number().min(0).max(1),
    classification: evidenceClassificationSchema.default("internal"),
    freshnessSeconds: z.number().int().nonnegative().optional(),
    contentHash: contentHashSchema.optional(),
    sourceVersionRef: sourceVersionRefSchema.optional(),
    parentEvidenceRefs: z.array(opaqueId).max(100).default([]),
  })
  .strict();

export const stateObservationSchema = tenantScopeSchema.extend({
  id: opaqueId.optional(),
  metricKey: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  value: z.union([z.number(), z.boolean(), z.string(), z.record(z.unknown())]),
  unit: z.string().min(1).max(32),
  observedAt: isoDateTime,
  ingestedAt: isoDateTime,
  evidenceId: opaqueId.optional(),
  freshnessSeconds: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const actionRequestSchema = tenantScopeSchema.extend({
  id: opaqueId.optional(),
  agentId: opaqueId,
  actionClass: z.string().min(1),
  adapter: z.string().min(1),
  resourceScope: z.string().min(1),
  idempotencyKey: z.string().min(8).max(256),
  requestedAt: isoDateTime,
});

/** CTO Decision 002: Intelligence output is a proposal, never a Decision or Action. */
export const agentRuntimeClaimClassificationSchema = z.enum([
  "verified_fact",
  "human_input",
  "external_information",
  "agent_inference",
  "insufficient_evidence",
]);
export const agentRuntimeClaimSchema = z
  .object({
    statement: z.string().min(1).max(10_000),
    classification: agentRuntimeClaimClassificationSchema,
    evidence_refs: z.array(opaqueId).max(100),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((claim, context) => {
    if (
      claim.classification === "verified_fact" &&
      claim.evidence_refs.length === 0
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence_refs"],
        message: "verified_fact requires evidence",
      });
  });
export const agentRuntimeRecommendationSchema = z
  .object({
    summary: z.string().min(1).max(10_000),
    rationale: z.string().min(1).max(10_000).optional(),
  })
  .strict();
export const agentRuntimeProposedTaskSchema = z
  .object({
    title: z.string().min(1).max(512),
    description: z.string().min(1).max(10_000).optional(),
  })
  .strict();
export const agentRuntimeProposedActionSchema = z
  .object({
    intent: z.string().min(1).max(1_000),
    rationale: z.string().min(1).max(10_000).optional(),
  })
  .strict();
export const agentRuntimeUncertaintySchema = z
  .object({
    type: z.enum([
      "missing_evidence",
      "stale_evidence",
      "conflicting_evidence",
      "low_confidence",
      "unknown",
    ]),
    detail: z.string().min(1).max(10_000).optional(),
  })
  .strict();
export const agentRuntimeOutputSchema = z
  .object({
    run_id: opaqueId,
    tenant_id: opaqueId,
    company_id: opaqueId,
    agent_id: opaqueId,
    summary: z.string().min(1).max(10_000),
    claims: z.array(agentRuntimeClaimSchema).max(100),
    recommendations: z.array(agentRuntimeRecommendationSchema).max(100),
    proposed_tasks: z.array(agentRuntimeProposedTaskSchema).max(100),
    proposed_actions: z.array(agentRuntimeProposedActionSchema).max(100),
    uncertainty: z.array(agentRuntimeUncertaintySchema).max(100),
    overall_confidence: z.number().min(0).max(1),
    generated_at: isoDateTime,
  })
  .strict();

/** CTO Decision 003: product contracts are scoped, denormalized projections. */
export const agentPresentationStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "awaiting_authority",
]);
export const charterVersionSummarySchema = z
  .object({
    id: opaqueId,
    version: z.number().int().positive(),
    mission: z.string().min(1).max(10_000),
  })
  .strict();
export const organizationGraphAgentSummarySchema = z
  .object({
    id: opaqueId,
    name: z.string().min(1).max(256),
    status: agentPresentationStatusSchema,
    charter: charterVersionSummarySchema,
    authoritySummary: z.string().min(1).max(2_000),
    currentWorkSummary: z.string().min(1).max(2_000),
    costSummary: z.string().min(1).max(2_000),
  })
  .strict();
export const organizationGraphNodeViewSchema = z
  .object({
    id: opaqueId,
    name: z.string().min(1).max(256),
    role: z.string().min(1).max(128),
    lifecycle: z.enum(["draft", "active", "archived"]),
    reportsToOrganizationNodeId: opaqueId.optional(),
    agents: z.array(organizationGraphAgentSummarySchema).max(100),
  })
  .strict();
export const organizationGraphViewSchema = tenantScopeSchema
  .extend({
    nodes: z.array(organizationGraphNodeViewSchema).max(1_000),
  })
  .strict();

export const agentDetailViewSchema = tenantScopeSchema
  .extend({
    id: opaqueId,
    name: z.string().min(1).max(256),
    status: agentPresentationStatusSchema,
    organizationNodeId: opaqueId,
    reportingLine: z.string().min(1).max(512),
    charter: charterVersionSummarySchema
      .extend({
        responsibilities: z.array(z.string().min(1).max(512)).max(100),
        allowedDataCapabilities: z.array(z.string().min(1).max(512)).max(100),
        allowedToolCapabilities: z.array(z.string().min(1).max(512)).max(100),
      })
      .strict(),
    authoritySummary: z.string().min(1).max(2_000),
    currentWorkSummary: z.string().min(1).max(2_000),
    costSummary: z.string().min(1).max(2_000),
    recentActivitySummary: z.string().min(1).max(2_000),
  })
  .strict();

export const companyStateCardViewSchema = tenantScopeSchema
  .extend({
    id: opaqueId,
    metricKey: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
    label: z.string().min(1).max(256),
    displayValue: z.string().min(1).max(2_000),
    unit: z.string().min(1).max(64),
    source: z.string().min(1).max(512),
    observedAt: isoDateTime.optional(),
    freshness: z.enum(["fresh", "stale", "unknown"]),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

export const objectiveViewSchema = tenantScopeSchema
  .extend({
    id: opaqueId,
    title: z.string().min(1).max(512),
    description: z.string().min(1).max(10_000),
    status: z.enum(["draft", "active", "at_risk"]),
    ownerLabel: z.string().min(1).max(256),
  })
  .strict();
export const createObjectiveSchema = tenantScopeSchema
  .extend({
    title: z.string().min(1).max(512),
    description: z.string().min(1).max(10_000),
    ownerOrganizationNodeId: opaqueId.optional(),
  })
  .strict();
/** CTO Decision 005 additive objective input; CreateObjective remains frozen. */
export const createObjectiveDetailedSchema = createObjectiveSchema
  .extend({
    targetDate: calendarDateSchema.optional(),
    successMeasureRefs: z.array(opaqueId).max(100).default([]),
  })
  .strict();

export const awaitingAuthorityViewSchema = tenantScopeSchema
  .extend({
    runId: opaqueId,
    agentId: opaqueId,
    state: z.literal("awaiting_authority"),
    output: agentRuntimeOutputSchema,
    presentedAt: isoDateTime,
  })
  .strict()
  .superRefine((view, context) => {
    if (view.output.run_id !== view.runId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output", "run_id"],
        message: "run must match view scope",
      });
    if (view.output.tenant_id !== view.tenantId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output", "tenant_id"],
        message: "tenant must match view scope",
      });
    if (view.output.company_id !== view.companyId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output", "company_id"],
        message: "company must match view scope",
      });
    if (view.output.agent_id !== view.agentId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output", "agent_id"],
        message: "agent must match view scope",
      });
  });

export const integrationConnectionViewSchema = tenantScopeSchema
  .extend({
    id: opaqueId,
    name: z.string().min(1).max(256),
    provider: z.string().min(1).max(256),
    capabilities: z.array(z.string().min(1).max(512)).max(100),
    scopeSummary: z.string().min(1).max(2_000),
    health: z.enum([
      "not_configured",
      "pending_verification",
      "active",
      "degraded",
      "revoked",
    ]),
    lastSyncAt: isoDateTime.nullable().optional(),
    connectionFlow: z.literal("server_initiated"),
  })
  .strict();

export const createOrganizationNodeSchema = tenantScopeSchema
  .extend({
    name: z.string().min(1).max(256),
    role: z.string().min(1).max(128),
    reportsToOrganizationNodeId: opaqueId.optional(),
  })
  .strict();
export const createAgentCharterVersionSchema = tenantScopeSchema
  .extend({
    organizationNodeId: opaqueId,
    mission: z.string().min(1).max(10_000),
    responsibilities: z.array(z.string().min(1).max(512)).max(100),
    allowedDataCapabilities: z.array(z.string().min(1).max(512)).max(100),
    allowedToolCapabilities: z.array(z.string().min(1).max(512)).max(100),
  })
  .strict();

export type OrganizationNode = z.infer<typeof organizationNodeSchema>;
export type AgentCharter = z.infer<typeof agentCharterSchema>;
export type CreateTenant = z.infer<typeof createTenantSchema>;
export type CreateCompany = z.infer<typeof createCompanySchema>;
export type CreateMembership = z.infer<typeof createMembershipSchema>;
export type ProvisionAgent = z.infer<typeof provisionAgentSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type RecordEvidence = z.infer<typeof recordEvidenceSchema>;
export type StateObservation = z.infer<typeof stateObservationSchema>;
export type ActionRequest = z.infer<typeof actionRequestSchema>;
export type AgentRuntimeOutput = z.infer<typeof agentRuntimeOutputSchema>;
export type OrganizationGraphView = z.infer<typeof organizationGraphViewSchema>;
export type AgentDetailView = z.infer<typeof agentDetailViewSchema>;
export type CompanyStateCardView = z.infer<typeof companyStateCardViewSchema>;
export type ObjectiveView = z.infer<typeof objectiveViewSchema>;
export type CreateObjective = z.infer<typeof createObjectiveSchema>;
export type CreateObjectiveDetailed = z.infer<
  typeof createObjectiveDetailedSchema
>;
export type AwaitingAuthorityView = z.infer<typeof awaitingAuthorityViewSchema>;
export type IntegrationConnectionView = z.infer<
  typeof integrationConnectionViewSchema
>;
export type CreateOrganizationNode = z.infer<
  typeof createOrganizationNodeSchema
>;
export type CreateAgentCharterVersion = z.infer<
  typeof createAgentCharterVersionSchema
>;
