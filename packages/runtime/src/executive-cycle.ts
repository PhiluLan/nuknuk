import type { AgentRuntimeOutput } from "@nuknuk/api-contracts";
import type { RunScope } from "./index.ts";

export type SpecialistProposal = Readonly<{
  runId: string;
  scope: RunScope;
  output: AgentRuntimeOutput;
}>;
export type ExecutiveSynthesisInput = Readonly<{
  scope: RunScope;
  specialistProposals: readonly SpecialistProposal[];
}>;

/** Structured composition seam only: it does not call a model, converse, persist, or authorize. */
export class ExecutiveCycleComposer {
  compose(
    scope: RunScope,
    proposals: readonly SpecialistProposal[],
  ): ExecutiveSynthesisInput {
    const accepted = proposals
      .map((proposal) => {
        if (
          !sameScope(proposal.scope, scope) ||
          !sameOutputScope(proposal.output, scope)
        )
          throw new Error("Specialist proposal is outside executive scope");
        return Object.freeze({ ...proposal });
      })
      .sort((left, right) => left.runId.localeCompare(right.runId));
    return Object.freeze({
      scope: Object.freeze({ ...scope }),
      specialistProposals: Object.freeze(accepted),
    });
  }
}

const sameScope = (left: RunScope, right: RunScope) =>
  left.tenantId === right.tenantId &&
  left.companyId === right.companyId &&
  left.agentId === right.agentId;
const sameOutputScope = (output: AgentRuntimeOutput, scope: RunScope) =>
  output.tenant_id === scope.tenantId &&
  output.company_id === scope.companyId &&
  output.agent_id === scope.agentId;
