# DEV-C NIGHT REPORT — Product Foundation

## Recommendation

**YELLOW for Dev-A persistence binding; GREEN for isolated Product Foundation.** The product experience is ready to consume the frozen inputs and canonical runtime output through its typed boundary. It must not bind to persistence until the requested read/mutation view contracts are approved.

## Delivered screens and routes

| Route              | Foundation                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `/onboarding`      | Decision-001 tenant/company bootstrap inputs                                                           |
| `/organization`    | Nodes, reporting relationships, agent operating summaries, draft node creation                         |
| `/agents/new`      | Decision-001 `ProvisionAgent` input using a selected charter version                                   |
| `/agents/:agentId` | Agent identity/status, charter, reporting line, capabilities, authority/current work/cost placeholders |
| `/company-state`   | Source, freshness, confidence and observed-time state cards; stale and unknown are visually distinct   |
| `/objectives`      | Typed local list/create foundation                                                                     |
| `/command-center`  | Founder questions plus explicit `awaiting_authority` attention state                                   |
| `/integrations`    | Capability/scope/health display without secret handling                                                |

## Service boundaries and frozen-contract integration

`ProductService` is the only browser data boundary. It consumes Decision-001 `CreateTenant`, `CreateCompany`, `CreateMembership`, and `ProvisionAgent` types and Decision-002 `AgentRuntimeOutput`. `FixtureProductService` is in-memory and explicitly non-production: it has no persistence, audit, authority, integration, credential, or execution behavior.

## Proposal and evidence UX

The Command Center labels `awaiting_authority` as **Proposal, not a Decision**. It separately renders verified fact, human input, external information, agent inference and insufficient evidence. Recommendations are labelled **not a Decision**, proposed tasks **not created work**, and proposed actions **not executed Actions**. Uncertainty is retained in the canonical runtime output.

## Accessibility and responsive evidence

- Semantic navigation/main structure, current route marker, labelled forms, native validation, skip link, keyboard focus treatment, and live state messages.
- Desktop shell has persistent navigation; at 900px founder cards compress, and at 720px navigation, cards and content become one-column.
- Automated tests cover Decision-001 fixture input, proposal-semantic labelling, stale/unknown state cards, and unavailable states.

## Fixture versus real seam inventory

| Surface                             | Current seam                                | Replacement dependency                    |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------- |
| Founder bootstrap / agent provision | Frozen input types through local fixture    | Dev A authenticated `/api/v1` endpoints   |
| Organization reads and node create  | Temporary view model / fixture              | Dev A organization graph service contract |
| Charter, objectives, company state  | Temporary view model / fixture              | CTO-approved transport/read models        |
| Runtime proposal, work, cost        | Canonical Decision-002 presentation fixture | Dev B/Dev A persisted projection contract |
| Integration health/configure        | Temporary display fixture                   | Dev A server-side connection flow         |

## Dependencies

- **Dev A:** authenticated, tenant-scoped API responses/mutations; RFC 9457 errors; organization/charter/objective/state/integration views; server-authorized bootstrap and provision responses.
- **Dev B:** presentation-safe run, work, usage/cost and `awaiting_authority` projection metadata, preserving canonical scope and proposal-only semantics.

## Decision requests

Created [Dev C Week 2 Product View Contracts](../cto-decision-requests/dev-c-week-2-product-view-contracts.md). No canonical contract was changed.

## Security and environment boundaries

No direct Supabase access, client secret, service-role credential, authority decision, DB/RLS change, production/staging mutation, or customer-specific product branch was introduced.

## Git status

The repository still has no commits and its baseline is untracked. Dev C changed only `apps/web`, the root package scripts/lockfile for the workspace dependency, this decision request, and this report; nothing was staged, committed, or pushed.
