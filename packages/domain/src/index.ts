/** Framework-free canonical vocabulary. No persistence, provider, or UI imports. */
export const authorityOutcomes = ["allow", "require_approval", "deny"] as const;
export type AuthorityOutcome = (typeof authorityOutcomes)[number];

export const agentStates = [
  "draft",
  "active",
  "paused",
  "suspended",
  "archived",
] as const;
export type AgentState = (typeof agentStates)[number];

export const decisionStates = [
  "draft",
  "proposed",
  "challenged",
  "approved",
  "rejected",
  "executed",
  "measured",
  "learned",
  "expired",
] as const;
export type DecisionState = (typeof decisionStates)[number];

export const evidenceTypes = [
  "verified_system_data",
  "human_input",
  "external_source",
  "agent_inference",
  "insufficient_evidence",
] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

export const actionStates = [
  "requested",
  "authorized",
  "dispatched",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type ActionState = (typeof actionStates)[number];

export const canTransitionAgent = (
  from: AgentState,
  to: AgentState,
): boolean => {
  const transitions: Record<AgentState, readonly AgentState[]> = {
    draft: ["active", "archived"],
    active: ["paused", "suspended", "archived"],
    paused: ["active", "archived"],
    suspended: ["archived"],
    archived: [],
  };
  return transitions[from].includes(to);
};
