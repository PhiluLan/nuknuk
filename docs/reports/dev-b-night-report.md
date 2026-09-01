# DEV-B NIGHT REPORT — Intelligence Foundation

**Recommendation: GREEN**

## ContextBuilder design and manifest behavior

`ContextBuilder` accepts a scoped run mandate/trigger, charter/version and allowed evidence classifications, read-only governance constraints, objectives, company state, evidence, optional decision/work placeholders, explicit model limits, and a bounded context budget. It orders sources deterministically by source class and ID, compacts by source-count and character limits, and returns every included source as a traceable scoped manifest entry. The manifest contains only included evidence IDs, sorted and de-duplicated.

## Retrieval interfaces and evidence controls

`EvidenceRetriever` is a persistence-neutral interface. Retrieval is filtered by tenant, company, agent, and charter-allowed evidence classification before ranking. Fixtures prove cross-tenant, cross-agent, and disallowed-classification evidence cannot enter a manifest. Evidence preserves its classification, collection time, freshness window, confidence, and opaque content reference in assembled context; no raw integration secret or external side effect is involved.

## Specialist and executive flow

`SpecialistAnalysisFlow` composes context, invokes the existing provider abstraction, validates the frozen `AgentRuntimeOutput`, and ends at `awaiting_authority`. A verified fact still requires manifest evidence. `ExecutiveCycleComposer` only sorts and scope-validates specialist proposals into an explicit synthesis input; it neither starts a chat loop nor calls a model, persists, authorizes, or executes.

## Evaluation evidence

Runtime fixtures cover fresh verified state, stale evidence, conflicting evidence, insufficient evidence, empty state, cross-tenant and cross-agent retrieval attempts, out-of-charter evidence, invented evidence, cost-cap stop, provider failure, and duplicate trigger. The runtime suite has 12 passing tests under Node 22.23.2.

The full Node-22 quality suite passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm format:check`.

## Cost and failure controls

Context source count and character budgets prevent unbounded history/prompt assembly. Existing per-run output-token, cost-cap, timeout, cancellation, provider-failure, and idempotency seams remain enforced. A non-accepted path exposes no canonical proposal.

## Dependencies

- **Dev A:** [Runtime persistence handoff](../dev-dependencies/dev-a-runtime-persistence-handoff.md) specifies durable AgentRun, usage, audit, idempotency, and application-side proposal-handoff expectations.
- **Dev C:** [Awaiting-authority presentation contract](../dev-dependencies/dev-c-awaiting-authority-presentation-contract.md) defines evidence and proposal visual semantics.

## Decision requests

None. Decision 002 was consumed without altering its frozen canonical output contract. No shared contract change was needed.

## Scope and Git status

No DB/RLS changes, Authority Engine, tool execution, raw secrets, external side effects, Backyrd-specific logic, or Supabase mutations were introduced. The repository remains an initial uncommitted/untracked worktree on `main`; no commit or push was created.
