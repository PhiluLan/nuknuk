# DEV-B DECISION-002 CLOSEOUT REPORT

**Recommendation: GREEN for the Decision-002 runtime-contract integration.**

## Contract diff

`@nuknuk/api-contracts` now owns strict `agentRuntimeOutputSchema` and `AgentRuntimeOutput`.

- Required root fields: `run_id`, `tenant_id`, `company_id`, `agent_id`, `summary`, `claims`, `recommendations`, `proposed_tasks`, `proposed_actions`, `uncertainty`, `overall_confidence`, and `generated_at`.
- Claims use only the approved classifications, have `evidence_refs` and `confidence`, and reject `verified_fact` claims without evidence.
- Recommendation, task, and action proposal objects are strict. Proposed tasks cannot carry IDs; proposed actions expose only intent/rationale and reject authorization, approval, credential, secret, execution-token, service-role, budget-override, and policy-override fields.
- The runtime's manifest uses deterministically sorted `evidence_refs`. Canonical output is accepted only when run/tenant/company/agent identifiers exactly match the manifest scope and every claim evidence reference is in that manifest.

## Runtime behavior

Runtime validates the canonical schema before any optional injected stricter validator. It returns a proposal only at `awaiting_authority`; it does not persist, grant authority, create a Decision or Action, execute a tool, or process secrets.

## Test evidence

- Node 22.23.2 installed and used through Volta.
- Contract tests: verified-fact-without-evidence, confidence bounds, persisted task IDs, and all forbidden action fields reject.
- Runtime tests: success, invented evidence, uncited verified fact, forbidden execution fields, malformed confidence, cross-scope identifiers, optional validator, timeout, cancellation, duplicate, and cost-cap paths.
- Full Node-22 quality suite passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Remaining dependencies

**Dev A:** reviewed durable AgentRun, usage/audit, and idempotency reservation contracts; application-side transition persistence; scope re-check at the persistence boundary.

**Dev C:** presentation-safe view model for `awaiting_authority` proposals, with visible distinctions between verified fact, input, inference, and insufficient evidence. No UI should imply a recommendation is a Decision or a proposed action is an Action.

## Scope confirmation

No database/RLS policy, persistence, Authority Engine, tool execution, integration secret handling, Backyrd-specific behavior, or Supabase environment was changed.
