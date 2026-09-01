# CTO Decision Request — Dev C Week 2 Product View Contracts

## Status

Approved by CTO Decision 003 on 2026-09-01. This request now records the approved canonical product contracts.

## Decision needed

Approve versioned, least-privilege `/api/v1` read and mutation view models for the Founder product experience:

1. Organization graph with reporting relationships and agent summary.
2. Agent detail with charter version, server-derived capability display, current-work, usage/cost and proposal state.
3. Company state cards with source, freshness, confidence and observed timestamp.
4. Objectives read/create flow.
5. Presentation-safe `awaiting_authority` projection of Decision-002 `AgentRuntimeOutput`.
6. Integration capability/scope/health projection and server-initiated configuration connection flow.
7. Organization-node creation and charter-version creation/view endpoints needed to complete Company → Node → Agent onboarding.

## Existing frozen inputs consumed by Dev C

- Decision 001 `CreateTenant`, `CreateCompany`, `CreateMembership`, and `ProvisionAgent` are consumed only through `ProductService`.
- Founder bootstrap remains a server-authenticated composition of `CreateTenant` and `CreateCompany`; the browser never supplies an authority outcome or a privileged identity.
- Decision 002 `AgentRuntimeOutput` is presented as an immutable proposal held at `awaiting_authority`. It is never labelled as a Decision, approval, or executed Action.

## Why a decision is needed

The frozen decisions deliberately do not define read models, response envelopes, organization-node creation, charter creation, objective transport, usage/cost projections, or a persisted runtime-proposal projection. Creating any of these in `@nuknuk/api-contracts` independently would violate ADR 0003.

## Proposed safety rules

- All responses are tenant/company scoped and server-authorized.
- Returned capability display is descriptive only; it is not a client-side permission grant.
- Raw credentials, credential metadata, authority policy internals, execution envelopes, and service-role identifiers are excluded.
- Runtime projections preserve Decision-002 proposal-only semantics and surface uncertainty.
- Mutations use idempotency and RFC 9457 problem responses before public API exposure.
