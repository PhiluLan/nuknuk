# CTO Decision Request — Dev B Week 1 Runtime Output Contract

**Status:** approved — CTO Decision 002

## Decision requested

Approved canonical structured agent-runtime output schema, owned by `@nuknuk/api-contracts`. It defines claims, evidence references, confidence, uncertainty, and proposed task/action references as proposals only.

## Why a decision is required

The current shared API contracts cover tenant/company-scoped foundation entities, but contain no approved agent-run output contract. Dev B must not create a shadow canonical schema or alter shared contracts independently.

## Implemented safe interim seam

`@nuknuk/runtime` always validates `AgentRuntimeOutput` first, including manifest evidence membership and run scope. An optional injected `StructuredOutputSchema<T>` can only add stricter checks for tests; it cannot bypass the canonical validation. Runtime neither persists output nor calls tools, integrations, authority, or database services. A run therefore ends at `awaiting_authority`; an application/control-plane service must perform every subsequent decision and mutation.

## Required Dev A input

Provide the reviewed persisted `AgentRun`/usage/audit and idempotency reservation contracts, including transition ownership and how tenant/company/agent scope is re-checked at persistence.

## Required Dev C input

Provide the presentation-safe view model for an output held at `awaiting_authority`, including a visible distinction between fact, inference, recommendation, and insufficient evidence.
