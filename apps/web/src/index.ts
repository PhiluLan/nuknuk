import type {
  AgentRuntimeOutput,
  AgentDetailView as ContractAgentDetailView,
  AwaitingAuthorityView,
  CompanyStateCardView as ContractCompanyStateCardView,
  CreateCompany,
  CreateAgentCharterVersion,
  CreateMembership,
  CreateObjective,
  CreateOrganizationNode,
  CreateTenant,
  IntegrationConnectionView,
  ObjectiveView as ContractObjectiveView,
  OrganizationGraphView,
  ProvisionAgent,
} from "@nuknuk/api-contracts";

/**
 * Product-only composition. The browser has no database, authority, execution,
 * credential, or privileged identity capability.
 */
export const applicationName = "nuknuk";

export type ScreenState =
  "ready" | "loading" | "empty" | "error" | "unauthorized";
export type Route =
  | "/onboarding"
  | "/organization"
  | "/agents/new"
  | "/agents/:agentId"
  | "/objectives"
  | "/company-state"
  | "/command-center"
  | "/integrations";

type CompanyDraft = Omit<CreateCompany, "tenantId">;
export type FounderBootstrapInput = Readonly<{
  tenant: CreateTenant;
  company: CompanyDraft;
}>;
export type OrganizationNodeView = Readonly<{
  id: string;
  name: string;
  role: string;
  lifecycle: "draft" | "active" | "archived";
  reportsTo?: string;
}>;
export type CharterSummaryView = Readonly<{
  versionId: string;
  version: number;
  mission: string;
  responsibilities: readonly string[];
  allowedDataCapabilities: readonly string[];
  allowedToolCapabilities: readonly string[];
}>;
export type AgentView = Readonly<{
  id: string;
  name: string;
  organizationNodeId: string;
  status: "draft" | "active" | "paused" | "awaiting_authority";
  charter: CharterSummaryView;
  authoritySummary: string;
  currentWorkSummary: string;
  costSummary: string;
}>;
export type CompanyStateCardView = Readonly<{
  id: string;
  label: string;
  value: string;
  source: string;
  observedAt: string;
  freshness: "fresh" | "stale" | "unknown";
  confidence: number | null;
}>;
export type ObjectiveView = Readonly<{
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "at_risk";
  owner: string;
}>;
export type IntegrationView = Readonly<{
  id: string;
  name: string;
  capability: string;
  scope: string;
  health: "healthy" | "degraded" | "not_configured";
}>;
export type RuntimeProposalView = Readonly<{
  state: "awaiting_authority";
  output: AgentRuntimeOutput;
}>;
export type ProductSnapshot = Readonly<{
  tenantId: string;
  company: Readonly<{
    id: string;
    name: string;
    timezone: string;
    baseCurrency: string;
  }>;
  organizationNodes: readonly OrganizationNodeView[];
  agents: readonly AgentView[];
  stateCards: readonly CompanyStateCardView[];
  objectives: readonly ObjectiveView[];
  integrations: readonly IntegrationView[];
  founderAttention: readonly RuntimeProposalView[];
}>;

/**
 * Browser/API boundary. Decision-001 inputs are used verbatim. Other methods
 * use temporary presentation models until Dev A freezes their API contracts.
 */
export interface ProductService {
  /** Fixture composition only; production bindings use the approved methods below. */
  getSnapshot(): Promise<ProductSnapshot>;
  getOrganizationGraph(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<OrganizationGraphView>;
  getAgentDetail(
    scope: Readonly<{ tenantId: string; companyId: string; agentId: string }>,
  ): Promise<ContractAgentDetailView>;
  getCompanyStateCards(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly ContractCompanyStateCardView[]>;
  listObjectives(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly ContractObjectiveView[]>;
  listAwaitingAuthority(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly AwaitingAuthorityView[]>;
  listIntegrationConnections(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly IntegrationConnectionView[]>;
  bootstrapFounder(input: FounderBootstrapInput): Promise<void>;
  createMembership(input: CreateMembership): Promise<void>;
  createOrganizationNode(input: CreateOrganizationNode): Promise<void>;
  createAgentCharterVersion(input: CreateAgentCharterVersion): Promise<void>;
  provisionAgent(input: ProvisionAgent): Promise<void>;
  createObjective(input: CreateObjective): Promise<void>;
}

const sampleOutput: AgentRuntimeOutput = {
  run_id: "run_fixture_1",
  tenant_id: "tenant_fixture_1",
  company_id: "company_fixture_1",
  agent_id: "agent_fixture_1",
  summary:
    "The current operating picture has one evidence-backed risk for Founder review.",
  claims: [
    {
      statement: "Weekly activation is below the current operating target.",
      classification: "verified_fact",
      evidence_refs: ["evidence_fixture_1"],
      confidence: 0.92,
    },
    {
      statement: "The Founder requested a retention review this week.",
      classification: "human_input",
      evidence_refs: ["evidence_fixture_2"],
      confidence: 1,
    },
    {
      statement:
        "Industry benchmark data suggests activation friction is a common cause.",
      classification: "external_information",
      evidence_refs: ["evidence_fixture_3"],
      confidence: 0.68,
    },
    {
      statement: "Activation friction may be contributing to the observed gap.",
      classification: "agent_inference",
      evidence_refs: ["evidence_fixture_1", "evidence_fixture_3"],
      confidence: 0.61,
    },
    {
      statement: "No current cohort breakdown is available.",
      classification: "insufficient_evidence",
      evidence_refs: [],
      confidence: 0.25,
    },
  ],
  recommendations: [
    {
      summary:
        "Review the activation funnel before changing customer messaging.",
      rationale: "The cohort breakdown is still missing.",
    },
  ],
  proposed_tasks: [
    {
      title: "Prepare activation cohort analysis",
      description: "Create a reviewable analysis brief for the Founder.",
    },
  ],
  proposed_actions: [
    {
      intent: "Request Founder authority to initiate the analysis workflow.",
      rationale: "This remains a proposal and has not been executed.",
    },
  ],
  uncertainty: [
    {
      type: "missing_evidence",
      detail: "Cohort-level activation data is unavailable.",
    },
  ],
  overall_confidence: 0.64,
  generated_at: "2026-08-30T18:00:00.000Z",
};

/**
 * Explicit local fixture. It is disposable, in-memory, and does not emulate
 * authorization, persistence, audit writes, external execution, or secrets.
 */
export class FixtureProductService implements ProductService {
  private snapshot: ProductSnapshot = {
    tenantId: "tenant_fixture_1",
    company: {
      id: "company_fixture_1",
      name: "Example Company",
      timezone: "Europe/Zurich",
      baseCurrency: "CHF",
    },
    organizationNodes: [
      {
        id: "node_founder",
        name: "Founder",
        role: "Executive",
        lifecycle: "active",
      },
      {
        id: "node_operations",
        name: "Operations",
        role: "Operations",
        lifecycle: "active",
        reportsTo: "node_founder",
      },
    ],
    agents: [
      {
        id: "agent_fixture_1",
        name: "Operating analyst",
        organizationNodeId: "node_operations",
        status: "awaiting_authority",
        charter: {
          versionId: "charter_fixture_1",
          version: 1,
          mission:
            "Synthesize company state into evidence-backed operating proposals.",
          responsibilities: ["State review", "Research synthesis"],
          allowedDataCapabilities: ["Read scoped state", "Read cited evidence"],
          allowedToolCapabilities: ["None until authorized"],
        },
        authoritySummary:
          "Authority is evaluated server-side; no authority outcome is shown here.",
        currentWorkSummary:
          "One runtime proposal is awaiting Founder authority.",
        costSummary:
          "Usage projection unavailable until the reviewed usage view is available.",
      },
    ],
    stateCards: [
      {
        id: "state_activation",
        label: "Weekly activation",
        value: "42%",
        source: "Verified system data",
        observedAt: "2026-08-30T16:00:00.000Z",
        freshness: "fresh",
        confidence: 0.92,
      },
      {
        id: "state_retention",
        label: "Retention cohort",
        value: "Unknown",
        source: "No current observation",
        observedAt: "Not observed",
        freshness: "unknown",
        confidence: null,
      },
      {
        id: "state_pipeline",
        label: "Pipeline coverage",
        value: "3.1×",
        source: "External information",
        observedAt: "2026-08-25T09:00:00.000Z",
        freshness: "stale",
        confidence: 0.55,
      },
    ],
    objectives: [
      {
        id: "objective_fixture_1",
        title: "Improve activation understanding",
        description: "Establish a reviewable cohort-level picture.",
        status: "active",
        owner: "Operations",
      },
    ],
    integrations: [
      {
        id: "integration_fixture_1",
        name: "Example integration",
        capability: "Read account status",
        scope: "Selected workspace",
        health: "not_configured",
      },
    ],
    founderAttention: [{ state: "awaiting_authority", output: sampleOutput }],
  };

  async getSnapshot(): Promise<ProductSnapshot> {
    return this.snapshot;
  }

  async getOrganizationGraph(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<OrganizationGraphView> {
    return {
      ...scope,
      nodes: this.snapshot.organizationNodes.map((node) => ({
        id: node.id,
        name: node.name,
        role: node.role,
        lifecycle: node.lifecycle,
        ...(node.reportsTo
          ? { reportsToOrganizationNodeId: node.reportsTo }
          : {}),
        agents: this.snapshot.agents
          .filter((agent) => agent.organizationNodeId === node.id)
          .map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            charter: {
              id: agent.charter.versionId,
              version: agent.charter.version,
              mission: agent.charter.mission,
            },
            authoritySummary: agent.authoritySummary,
            currentWorkSummary: agent.currentWorkSummary,
            costSummary: agent.costSummary,
          })),
      })),
    };
  }

  async getAgentDetail(
    scope: Readonly<{ tenantId: string; companyId: string; agentId: string }>,
  ): Promise<ContractAgentDetailView> {
    const agent = this.snapshot.agents.find(
      (candidate) => candidate.id === scope.agentId,
    );
    if (!agent) throw new Error("Fixture agent not found");
    const node = this.snapshot.organizationNodes.find(
      (candidate) => candidate.id === agent.organizationNodeId,
    );
    return {
      tenantId: scope.tenantId,
      companyId: scope.companyId,
      id: agent.id,
      name: agent.name,
      status: agent.status,
      organizationNodeId: agent.organizationNodeId,
      reportingLine: node?.name ?? "Unknown",
      charter: {
        id: agent.charter.versionId,
        version: agent.charter.version,
        mission: agent.charter.mission,
        responsibilities: [...agent.charter.responsibilities],
        allowedDataCapabilities: [...agent.charter.allowedDataCapabilities],
        allowedToolCapabilities: [...agent.charter.allowedToolCapabilities],
      },
      authoritySummary: agent.authoritySummary,
      currentWorkSummary: agent.currentWorkSummary,
      costSummary: agent.costSummary,
      recentActivitySummary:
        agent.status === "awaiting_authority"
          ? "A proposal awaits Founder authority."
          : "No activity available.",
    };
  }

  async getCompanyStateCards(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly ContractCompanyStateCardView[]> {
    return this.snapshot.stateCards.map((card) => ({
      ...scope,
      id: card.id,
      metricKey: card.id.replace("state_", ""),
      label: card.label,
      displayValue: card.value,
      source: card.source,
      ...(card.observedAt === "Not observed"
        ? {}
        : { observedAt: card.observedAt }),
      freshness: card.freshness,
      confidence: card.confidence,
    }));
  }

  async listObjectives(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly ContractObjectiveView[]> {
    return this.snapshot.objectives.map((objective) => ({
      ...scope,
      id: objective.id,
      title: objective.title,
      description: objective.description,
      status: objective.status,
      ownerLabel: objective.owner,
    }));
  }

  async listAwaitingAuthority(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly AwaitingAuthorityView[]> {
    return this.snapshot.founderAttention.map((proposal) => ({
      ...scope,
      runId: proposal.output.run_id,
      agentId: proposal.output.agent_id,
      state: proposal.state,
      output: proposal.output,
      presentedAt: proposal.output.generated_at,
    }));
  }

  async listIntegrationConnections(
    scope: Readonly<{ tenantId: string; companyId: string }>,
  ): Promise<readonly IntegrationConnectionView[]> {
    return this.snapshot.integrations.map((integration) => ({
      ...scope,
      id: integration.id,
      name: integration.name,
      capabilities: [integration.capability],
      scopeSummary: integration.scope,
      health: integration.health === "healthy" ? "active" : integration.health,
      connectionFlow: "server_initiated",
    }));
  }

  async bootstrapFounder(input: FounderBootstrapInput): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      tenantId: "tenant_fixture_1",
      company: {
        id: "company_fixture_1",
        name: input.company.name,
        timezone: input.company.timezone,
        baseCurrency: input.company.baseCurrency,
      },
    };
  }

  async createMembership(_input: CreateMembership): Promise<void> {
    // Founder bootstrap is server-authorized; ordinary membership UI is deferred.
  }

  async createOrganizationNode(input: CreateOrganizationNode): Promise<void> {
    const node: OrganizationNodeView = {
      id: `node_fixture_${this.snapshot.organizationNodes.length + 1}`,
      name: input.name,
      role: input.role,
      lifecycle: "draft",
      reportsTo: input.reportsToOrganizationNodeId ?? "node_founder",
    };
    this.snapshot = {
      ...this.snapshot,
      organizationNodes: [...this.snapshot.organizationNodes, node],
    };
  }

  async createAgentCharterVersion(
    _input: CreateAgentCharterVersion,
  ): Promise<void> {
    // The fixture keeps its selected charter stable; real persistence is server-owned.
  }

  async provisionAgent(input: ProvisionAgent): Promise<void> {
    const charter = this.snapshot.agents[0]?.charter;
    if (
      !charter ||
      !this.snapshot.organizationNodes.some(
        (node) => node.id === input.organizationNodeId,
      )
    )
      throw new Error(
        "Fixture cannot provision an agent without a valid node and charter",
      );
    const agent: AgentView = {
      id: `agent_fixture_${this.snapshot.agents.length + 1}`,
      name: `Draft agent ${this.snapshot.agents.length + 1}`,
      organizationNodeId: input.organizationNodeId,
      status: "draft",
      charter,
      authoritySummary: "Authority is evaluated server-side.",
      currentWorkSummary: "No current work.",
      costSummary: "Usage projection unavailable.",
    };
    this.snapshot = {
      ...this.snapshot,
      agents: [...this.snapshot.agents, agent],
    };
  }

  async createObjective(input: CreateObjective): Promise<void> {
    const objective: ObjectiveView = {
      id: `objective_fixture_${this.snapshot.objectives.length + 1}`,
      title: input.title,
      description: input.description,
      status: "draft",
      owner: "Unassigned",
    };
    this.snapshot = {
      ...this.snapshot,
      objectives: [...this.snapshot.objectives, objective],
    };
  }
}

const navigation: ReadonlyArray<readonly [Route, string]> = [
  ["/command-center", "Command center"],
  ["/organization", "Organization"],
  ["/objectives", "Objectives"],
  ["/company-state", "Company state"],
  ["/integrations", "Integrations"],
];

const productCss = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#152018;background:#f4f7f4}*{box-sizing:border-box}body{margin:0}.app-shell{min-height:100vh;display:grid;grid-template-columns:16rem minmax(0,1fr)}aside{padding:2rem 1rem;background:#123322;color:#fff}.brand{display:block;margin:0 .75rem 2rem;font-size:1.4rem;font-weight:800;color:inherit;text-decoration:none}nav{display:grid;gap:.25rem}nav a{padding:.7rem .75rem;color:#dce8df;text-decoration:none;border-radius:.5rem}nav a[aria-current=page],nav a:hover{background:#28533a;color:#fff}main{width:min(100%,76rem);padding:2.5rem clamp(1.25rem,5vw,4rem)}h1{margin:0;font-size:clamp(2rem,4vw,3rem)}h2,h3{margin-top:0}.eyebrow,.muted,li span{display:block;color:#506455;margin-top:.3rem}.eyebrow{margin:0 0 .45rem;font-weight:700}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.grid--two{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.card,section,article,form,li{border:1px solid #d5ded7;border-radius:.75rem;background:#fff;padding:1rem}.card--attention{border-left:4px solid #bf7b12}.card--stale{border-color:#cc8b2a;background:#fff8e9}.card--unknown{border-style:dashed;background:#f7f7f7}.badge{display:inline-block;padding:.2rem .45rem;border-radius:999px;background:#e7efe9;font-size:.8rem;font-weight:700}.badge--proposal{background:#fff2d8;color:#704c00}.badge--fact{background:#e4f1e7;color:#1d6136}.badge--unknown{background:#eee;color:#4d4d4d}section,form{margin-top:1rem}form{display:grid;gap:.8rem;max-width:42rem}label{display:grid;gap:.35rem;font-weight:600}input,select,textarea,button,.button{font:inherit;padding:.65rem .75rem;border-radius:.45rem;border:1px solid #a8b9ac}textarea{min-height:6rem}button,.button{width:fit-content;border:0;background:#1d6136;color:#fff;cursor:pointer;text-decoration:none}button:disabled{opacity:.65;cursor:not-allowed}ul{display:grid;gap:.7rem;padding:0;list-style:none}.state{color:#4b6252}.state--error,.state--unauthorized{color:#8d1d1d;border-color:#f0bbbb}.skip-link{position:absolute;left:-10000px}.skip-link:focus{left:1rem;top:1rem;z-index:10;padding:.5rem;background:#fff}:focus-visible{outline:3px solid #e4ab31;outline-offset:3px}@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.app-shell{grid-template-columns:1fr}aside{padding:1rem}nav{grid-template-columns:repeat(2,minmax(0,1fr))}.brand{margin:0 0 1rem}main{padding:1.5rem 1rem}.grid,.grid--two,.summary-grid{grid-template-columns:1fr}}`;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );

const stateMessage = (state: ScreenState): string =>
  ({
    loading: "Loading your workspace…",
    empty: "Nothing has been created yet.",
    error: "We could not load this information. Try again.",
    unauthorized: "You do not have access to this workspace.",
    ready: "",
  })[state];

const errorScreenState = (error: unknown): ScreenState =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  ((error as { status?: unknown }).status === 401 ||
    (error as { status?: unknown }).status === 403)
    ? "unauthorized"
    : "error";

const routeLabel = (route: Route): string =>
  navigation.find(([target]) => target === route)?.[1] ??
  (route === "/onboarding"
    ? "Company setup"
    : route === "/agents/new"
      ? "Provision agent"
      : "Agent detail");

export const renderState = (state: ScreenState): string =>
  state === "ready"
    ? ""
    : `<section class="state state--${state}" role="status" aria-live="polite">${stateMessage(state)}</section>`;

export const renderShell = (
  route: Route,
  content: string,
  state: ScreenState = "ready",
): string =>
  `<style>${productCss}</style><a class="skip-link" href="#main">Skip to content</a><div class="app-shell"><aside aria-label="Primary navigation"><a class="brand" href="#/command-center">nuknuk</a><nav>${navigation.map(([target, label]) => `<a href="#${target}" ${target === route ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav></aside><main id="main" tabindex="-1"><header><p class="eyebrow">Tenant workspace</p><h1>${routeLabel(route)}</h1></header>${renderState(state)}${state === "ready" ? content : ""}</main></div>`;

const confidence = (value: number | null): string =>
  value === null
    ? "Confidence unknown"
    : `Confidence ${Math.round(value * 100)}%`;

const renderStateCard = (card: CompanyStateCardView): string =>
  `<article class="card card--${card.freshness}"><span class="badge badge--${card.freshness === "fresh" ? "fact" : "unknown"}">${card.freshness}</span><h3>${escapeHtml(card.label)}</h3><p>${escapeHtml(card.value)}</p><span>${escapeHtml(card.source)} · ${escapeHtml(card.observedAt)} · ${confidence(card.confidence)}</span></article>`;

const claimLabel: Record<
  AgentRuntimeOutput["claims"][number]["classification"],
  string
> = {
  verified_fact: "Verified fact",
  human_input: "Human input",
  external_information: "External information",
  agent_inference: "Agent inference",
  insufficient_evidence: "Insufficient evidence",
};

export const renderProposal = (proposal: RuntimeProposalView): string => {
  const output = proposal.output;
  return `<section class="card card--attention"><span class="badge badge--proposal">Awaiting Founder authority</span><h2>Proposal, not a Decision</h2><p>${escapeHtml(output.summary)}</p><p class="muted">Generated ${escapeHtml(output.generated_at)} · ${confidence(output.overall_confidence)}</p><div class="grid grid--two"><article><h3>Evidence and claims</h3><ul>${output.claims.map((claim) => `<li><span class="badge badge--${claim.classification === "verified_fact" ? "fact" : claim.classification === "insufficient_evidence" ? "unknown" : "proposal"}">${claimLabel[claim.classification]}</span><strong>${escapeHtml(claim.statement)}</strong><span>${confidence(claim.confidence)} · ${claim.evidence_refs.length ? `Evidence refs: ${claim.evidence_refs.map(escapeHtml).join(", ")}` : "No evidence reference"}</span></li>`).join("")}</ul></article><article><h3>Recommendations and proposals</h3><h4>Recommendation — not a Decision</h4><ul>${output.recommendations.map((item) => `<li><strong>${escapeHtml(item.summary)}</strong><span>${escapeHtml(item.rationale ?? "No rationale supplied")}</span></li>`).join("")}</ul><h4>Proposed tasks — not created work</h4><ul>${output.proposed_tasks.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description ?? "No description supplied")}</span></li>`).join("")}</ul><h4>Proposed actions — not executed Actions</h4><ul>${output.proposed_actions.map((item) => `<li><strong>${escapeHtml(item.intent)}</strong><span>${escapeHtml(item.rationale ?? "No rationale supplied")}</span></li>`).join("")}</ul></article></div></section>`;
};

const renderOrganization = (snapshot: ProductSnapshot): string =>
  `<p class="muted">${escapeHtml(snapshot.company.name)} · ${escapeHtml(snapshot.company.timezone)} · ${escapeHtml(snapshot.company.baseCurrency)}</p><section><h2>Organization graph</h2><ul>${snapshot.organizationNodes.map((node) => `<li><strong>${escapeHtml(node.name)}</strong><span>${escapeHtml(node.role)} · ${node.lifecycle} · Reports to: ${escapeHtml(snapshot.organizationNodes.find((candidate) => candidate.id === node.reportsTo)?.name ?? "—")}</span></li>`).join("")}</ul><form data-action="organization"><label>Node name<input required name="name" /></label><label>Role<input required name="role" placeholder="Operations" /></label><button>Create draft node</button></form></section><section><h2>Agents</h2><ul>${snapshot.agents.map((agent) => `<li><a href="#/agents/${escapeHtml(agent.id)}"><strong>${escapeHtml(agent.name)}</strong></a><span>${agent.status} · Charter v${agent.charter.version} · ${escapeHtml(agent.authoritySummary)} · ${escapeHtml(agent.currentWorkSummary)} · ${escapeHtml(agent.costSummary)}</span></li>`).join("")}</ul></section>`;

const renderAgentDetail = (
  snapshot: ProductSnapshot,
  agentId: string,
): string => {
  const agent = snapshot.agents.find((candidate) => candidate.id === agentId);
  if (!agent) return renderShell("/organization", "", "empty");
  const node = snapshot.organizationNodes.find(
    (candidate) => candidate.id === agent.organizationNodeId,
  );
  return renderShell(
    "/agents/:agentId",
    `<section><span class="badge">${agent.status}</span><h2>${escapeHtml(agent.name)}</h2><p>${escapeHtml(agent.charter.mission)}</p><p class="muted">Reporting line: ${escapeHtml(node?.name ?? "Unknown")} · Charter v${agent.charter.version}</p></section><div class="grid grid--two"><section><h2>Charter and capabilities</h2><h3>Responsibilities</h3><ul>${agent.charter.responsibilities.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul><h3>Allowed data capabilities</h3><ul>${agent.charter.allowedDataCapabilities.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul><h3>Allowed tool capabilities</h3><ul>${agent.charter.allowedToolCapabilities.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></section><section><h2>Operating context</h2><p><strong>Authority:</strong> ${escapeHtml(agent.authoritySummary)}</p><p><strong>Current work:</strong> ${escapeHtml(agent.currentWorkSummary)}</p><p><strong>Cost:</strong> ${escapeHtml(agent.costSummary)}</p><p><strong>Recent activity:</strong> ${agent.status === "awaiting_authority" ? "A proposal awaits Founder authority." : "No activity available."}</p></section></div>`,
  );
};

export const renderProduct = (
  route: Route,
  snapshot: ProductSnapshot,
): string => {
  const charter = snapshot.agents[0]?.charter;
  const content: Record<Exclude<Route, "/agents/:agentId">, string> = {
    "/onboarding": `<p>Set up the tenant and company through the frozen Decision-001 bootstrap boundary. Founder membership is derived and authorized server-side.</p><form data-action="bootstrap"><label>Tenant name<input required name="tenantName" autocomplete="organization" /></label><label>Tenant slug<input required name="tenantSlug" pattern="[a-z0-9][a-z0-9-]{1,62}" /></label><label>Company name<input required name="companyName" /></label><label>Company slug<input required name="companySlug" pattern="[a-z0-9][a-z0-9-]{1,62}" /></label><label>Timezone<input required name="timezone" value="Europe/Zurich" /></label><label>Base currency<input required name="baseCurrency" value="CHF" pattern="[A-Z]{3}" /></label><button>Set up company</button></form>`,
    "/organization": renderOrganization(snapshot),
    "/agents/new": charter
      ? `<p>Provisioning uses the frozen Decision-001 ` +
        "`ProvisionAgent`" +
        ` input. Charter creation is intentionally not invented in the browser.</p><form data-action="provision-agent"><label>Organization node<select required name="organizationNodeId">${snapshot.organizationNodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.name)}</option>`).join("")}</select></label><label>Approved charter version<select required name="charterVersionId"><option value="${escapeHtml(charter.versionId)}">Version ${charter.version} · ${escapeHtml(charter.mission)}</option></select></label><button>Provision draft agent</button></form>`
      : renderState("empty"),
    "/objectives": `<section><h2>Objectives</h2><ul>${snapshot.objectives.map((objective) => `<li><strong>${escapeHtml(objective.title)}</strong><span>${objective.status} · ${escapeHtml(objective.owner)} · ${escapeHtml(objective.description)}</span></li>`).join("")}</ul><form data-action="objective"><label>Objective title<input required name="title" /></label><label>Description<textarea required name="description"></textarea></label><button>Create draft objective</button></form></section>`,
    "/company-state": `<p>State is presented with source, observed timestamp, freshness and confidence. Stale and unknown observations are intentionally distinct.</p><div class="grid">${snapshot.stateCards.map(renderStateCard).join("")}</div>`,
    "/command-center": `<div class="grid summary-grid"><article class="card"><h2>How is the company doing?</h2><p>${escapeHtml(snapshot.stateCards[0]?.value ?? "Unknown")}</p></article><article class="card"><h2>What changed?</h2><p>${snapshot.stateCards.filter((card) => card.freshness !== "fresh").length} state signals need context.</p></article><article class="card"><h2>What is the organization doing?</h2><p>${snapshot.agents.length} agent view(s) available.</p></article><article class="card card--attention"><h2>What needs Founder attention?</h2><p>${snapshot.founderAttention.length} proposal(s) awaiting authority.</p></article><article class="card"><h2>What should the Founder know next?</h2><p>Evidence-backed recommendations remain proposals.</p></article></div>${snapshot.founderAttention.map(renderProposal).join("")}`,
    "/integrations": `<p>Connection setup is delegated to a server-side flow. This surface never receives or stores raw credentials.</p><ul>${snapshot.integrations.map((integration) => `<li><strong>${escapeHtml(integration.name)}</strong><span>Capability: ${escapeHtml(integration.capability)} · Scope: ${escapeHtml(integration.scope)} · Health: ${integration.health}</span><button type="button" disabled aria-describedby="integration-note">Configure when server flow is available</button></li>`).join("")}</ul><p id="integration-note">Configuration is unavailable until the reviewed server-side integration contract exists.</p>`,
  };
  return renderShell(
    route,
    content[route as Exclude<Route, "/agents/:agentId">],
  );
};

const toRoute = (hash: string): { route: Route; agentId?: string } => {
  if (hash.startsWith("/agents/") && hash !== "/agents/new")
    return {
      route: "/agents/:agentId",
      agentId: hash.slice("/agents/".length),
    };
  const routes = [
    "/onboarding",
    "/organization",
    "/agents/new",
    "/objectives",
    "/company-state",
    "/command-center",
    "/integrations",
  ] as const;
  return routes.some((route) => route === hash)
    ? { route: hash as Route }
    : { route: "/command-center" };
};

export class ProductApp {
  private route: Route = "/command-center";
  private agentId?: string;

  constructor(
    private readonly root: HTMLElement,
    private readonly service: ProductService = new FixtureProductService(),
  ) {}

  async start(): Promise<void> {
    window.addEventListener("hashchange", () => void this.navigate());
    await this.navigate();
  }

  private async navigate(): Promise<void> {
    const target = toRoute(window.location.hash.slice(1));
    this.route = target.route;
    if (target.agentId) this.agentId = target.agentId;
    else delete this.agentId;
    this.root.innerHTML = renderShell(this.route, "", "loading");
    try {
      const snapshot = await this.service.getSnapshot();
      this.root.innerHTML = this.agentId
        ? renderAgentDetail(snapshot, this.agentId)
        : renderProduct(this.route, snapshot);
      this.bindForms();
    } catch (error) {
      this.root.innerHTML = renderShell(
        this.route,
        "",
        errorScreenState(error),
      );
    }
  }

  private bindForms(): void {
    this.root
      .querySelectorAll<HTMLFormElement>("form[data-action]")
      .forEach((form) =>
        form.addEventListener(
          "submit",
          (event) => void this.submit(event, form),
        ),
      );
  }

  private async submit(
    event: SubmitEvent,
    form: HTMLFormElement,
  ): Promise<void> {
    event.preventDefault();
    const values = new FormData(form);
    const value = (name: string): string =>
      String(values.get(name) ?? "").trim();
    try {
      if (form.dataset.action === "bootstrap") {
        await this.service.bootstrapFounder({
          tenant: { name: value("tenantName"), slug: value("tenantSlug") },
          company: {
            name: value("companyName"),
            slug: value("companySlug"),
            timezone: value("timezone"),
            baseCurrency: value("baseCurrency"),
          },
        });
        window.location.hash = "/organization";
      } else if (form.dataset.action === "organization") {
        const snapshot = await this.service.getSnapshot();
        await this.service.createOrganizationNode({
          tenantId: snapshot.tenantId,
          companyId: snapshot.company.id,
          name: value("name"),
          role: value("role"),
          reportsToOrganizationNodeId: "node_founder",
        });
        await this.navigate();
      } else if (form.dataset.action === "provision-agent") {
        const snapshot = await this.service.getSnapshot();
        await this.service.provisionAgent({
          tenantId: snapshot.tenantId,
          companyId: snapshot.company.id,
          organizationNodeId: value("organizationNodeId"),
          charterVersionId: value("charterVersionId"),
        });
        window.location.hash = "/organization";
      } else if (form.dataset.action === "objective") {
        const snapshot = await this.service.getSnapshot();
        await this.service.createObjective({
          tenantId: snapshot.tenantId,
          companyId: snapshot.company.id,
          title: value("title"),
          description: value("description"),
        });
        await this.navigate();
      }
    } catch (error) {
      this.root.innerHTML = renderShell(
        this.route,
        "",
        errorScreenState(error),
      );
    }
  }
}

export { ApiProductService, ProductApiError } from "./api-product-service.ts";
export type {
  ProductApiContext,
  ProductApiRoutes,
  ProductApiTransport,
} from "./api-product-service.ts";
