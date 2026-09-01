# ADR 0003: Canonical contracts

## Status

Accepted

## Decision

Zod schemas in `@nuknuk/api-contracts` are the initial transport contract source. `@nuknuk/domain` owns language-independent semantics such as lifecycle values and authority outcomes. No package may create a parallel shadow definition for core entities.

## Consequences

Shared changes need CTO review, an ADR for material semantic changes, and compatibility notes in the PR.
