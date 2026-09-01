# Senior Developer Mandate — Dev B: Intelligence / Runtime

## Ownership

Own the run lifecycle, context-assembly interfaces, structured-output validation harness, model-provider abstraction, queue/worker seams, evidence interpretation, executive-cycle orchestration, cost/failure controls and runtime evaluation fixtures.

## Do not touch without CTO review

Do not alter database/RLS policy, authority semantics, canonical shared schemas, or UI/API shape independently. Do not execute a tool directly, handle raw integration secrets, grant authority, or add Backyrd-specific runtime logic.

## Week 1 objective

Build a provider-agnostic, testable agent-run skeleton: a queued run has scoped input, produces schema-validated structured output under a mocked provider, records no unvalidated state mutation, and exposes failure/cost hooks. Integrate only against the reviewed Dev A contract.

## Required outputs

1. Run state/lifecycle interface aligned to `queued → assembling_context → running → terminal/awaiting_authority`.
2. `ModelProvider` and structured-output adapter with mocked test provider; no real key required.
3. Deterministic context manifest shape carrying tenant/company/agent scope and citation references.
4. Failure, timeout, cancellation, duplicate/idempotency and cost-cap test fixtures.
5. A documented dependency request to Dev A for persisted entities and to Dev C for presentation-safe view models.

## Acceptance criteria

- Runtime rejects output that does not conform to the canonical schema.
- An agent cannot obtain an adapter credential or cause a side effect from runtime output.
- Every run/manifest preserves tenant and company scope and produces traceable IDs.
- Mocks demonstrate structured success, invalid output, timeout and cap-stop paths.
- `pnpm lint`, `typecheck`, `test`, and `build` stay green.

## Handoffs

At 24 hours: submit the context/run contract and test fixtures for CTO review. At 48 hours: demo a scoped mock run using the reviewed foundation, publish interface gaps and dependency status to Dev A/C and CTO.

## 48-hour integration review

Bring state/contract diff, failure/cost test evidence, a mocked run trace and explicit proof that no tool execution or authority decision occurs in the runtime.
