# DEV-B WEEK-2 REPORT — Real Intelligence Loop

**Integration recommendation: GREEN for the scoped Runtime loop; YELLOW for end-to-end deployment until Dev A wires the server application-service implementation.**

## Commits

- `cf38b49` — scoped intelligence handoff, deterministic uncertainty handling, and persistence-handoff fixtures.
- `daef977` — audit-correlation propagation through the Control Plane handoff.

## ContextBuilder architecture

`ContextBuilder` takes a scoped mandate/trigger, agent charter/version, reporting-safe placeholders, read-only governance constraints, objectives, Company State, Evidence, prior work/decision references, model limits, and a source/character budget. Source ordering is deterministic and compaction happens before the manifest is created. Every included item has a kind, opaque reference, tenant/company or global scope, and deterministic manifest presence.

Retrieval enforces the required order: tenant → company → agent/charter data scope → classification → freshness → relevance ranking. It never ranks an out-of-scope item. Evidence retains classification, collection time, freshness window, confidence, and opaque content reference. Model-generated evidence IDs remain rejected unless they occur in the final manifest.

## Specialist analysis trace

`PersistedSpecialistAnalysisFlow` performs:

`reserve run → load scoped context → assembling_context → persist manifest pointer → running → provider → canonical output validation → usage handoff → awaiting_authority transition`.

It never creates a Decision, Task, Action, approval, authority result, tool call, or business-state mutation. Stale, missing, and explicitly conflicting included evidence become required output uncertainty types. A missing uncertainty causes validation failure rather than accepted work.

## Service integration seams

`AgentRunApplicationService` is a runtime-owned application boundary, not a database abstraction. It requests Dev A's reviewed run reservation, context-manifest pointer, lifecycle transition, normalized usage persistence, and audit-correlation coupling. `CompanyIntelligenceContextService` supplies the scoped read model. Runtime does not import `@nuknuk/db`.

## Cost and failure controls

Per-run token/cost limits, timeout, cancellation, provider failure, malformed output, duplicate idempotency handling, scope mismatch, invented evidence references, missing context uncertainty, and persistence handoff failure all terminate without an accepted proposal. Usage is normalized from provider input/output tokens and estimated cents before application-boundary persistence.

## Evaluation evidence

The Runtime suite has 14 passing fixtures covering healthy fresh state, stale state/evidence, conflicting evidence, insufficient/empty evidence, wrong tenant/company/agent, charter-disallowed evidence, invented citations, provider error, timeout, cancellation, duplicate run, cost-cap stop, and persistence-handoff failure.

## Dev A / Dev C handoffs

- Dev A exact requirements: [runtime persistence handoff](../dev-dependencies/dev-a-runtime-persistence-handoff.md).
- Dev C presentation semantics: [awaiting-authority presentation contract](../dev-dependencies/dev-c-awaiting-authority-presentation-contract.md).

## Decision requests and known gaps

No CTO Decision Request is required; frozen `AgentRuntimeOutput` was not changed. The remaining gap is implementation of the reviewed application-service interfaces by the Control Plane and a real provider only when a server-side secure configuration exists. No secrets were requested or used.

## Scope confirmation

No DB/RLS, Authority Engine, API authorization, product UI, tool execution, raw secret, Backyrd-specific logic, staging, or production change was made.
