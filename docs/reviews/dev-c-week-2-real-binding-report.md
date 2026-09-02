# DEV-C WEEK-2 REPORT — Real Product Binding

## Branch and baseline

- Branch: `dev-c/product-command-center`
- Baseline: `df7e05125a8597c78d789bc2eb52a269cf4389c6`
- Worktree: `/Users/philippjohanna/dev/nuknuk-dev-c`

## ProductService architecture

`ProductService` remains the sole UI boundary. `FixtureProductService` is an explicit, in-memory fallback. `ApiProductService` is a server/API adapter that accepts an injected transport and Dev-A-owned route map, validates every response with Decision-001/003 schemas, sends mutations with client idempotency keys, and has no Supabase, DB, service-role or credential dependency. The UI does not branch on service implementation.

## Routes and binding inventory

| Route                             | Current state                                                          | Contract                                                         |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/onboarding`                     | Fixture-backed pending server bootstrap endpoint                       | Decision 001 tenant/company bootstrap                            |
| `/organization`                   | Fixture-backed; API adapter ready                                      | `OrganizationGraphView`, `CreateOrganizationNode`                |
| `/agents/new`, `/agents/:agentId` | Fixture-backed; API adapter ready                                      | `ProvisionAgent`, `CreateAgentCharterVersion`, `AgentDetailView` |
| `/company-state`                  | Fixture-backed; API adapter ready                                      | `CompanyStateCardView`                                           |
| `/objectives`                     | Fixture-backed; API adapter ready                                      | `ObjectiveView`, `CreateObjective`                               |
| `/command-center`                 | Fixture-backed composition; API adapter ready for approved projections | `AwaitingAuthorityView` plus approved views                      |
| `/integrations`                   | Fixture-backed; API adapter ready                                      | `IntegrationConnectionView`                                      |

No real Dev-A HTTP endpoint exists in this worktree, so no screen is marked real API-bound. This avoids bypassing the server/application boundary.

## Onboarding flow

Founder bootstrap remains a server-side composition of Decision-001 tenant/company inputs. Node, charter and agent provision have isolated typed seams. `ApiProductService` validates the frozen inputs before dispatch; the fixture keeps the flow runnable until Dev A supplies authenticated endpoints.

## Company State, Objectives and proposal UX

Company state renders approved value/source/time/freshness/confidence data and clearly styles stale and unknown cards. Objectives use scoped `CreateObjective` through the service boundary. `AwaitingAuthorityView` remains proposal-only: evidence categories, recommendations, tasks and proposed actions are visibly distinct; it does not render a Decision, approval result or executed Action.

## Accessibility and responsive evidence

The existing shell retains labelled native forms, keyboard focus styling, skip link, semantic navigation/main content and live loading/error/unauthorized states. Layout collapses to mobile single-column at 720px. Smoke tests cover contract parsing, proposal labels, state freshness, fixture/API service behavior and explicit unauthorized error representation.

## Dev-A dependencies

Required server endpoints: founder bootstrap; organization graph; node creation; charter-version creation; provision agent; agent detail; company-state cards; objectives list/create; awaiting-authority projection; integration connection list and server-initiated connect flow. Each mutation needs authenticated tenant/company/owner authorization, idempotency and RFC-9457 responses.

## Dev-B dependencies

Provide persisted, presentation-safe `AwaitingAuthorityView` projections from canonical `AgentRuntimeOutput`, preserving scope and proposal-only semantics. No runtime output may become an approval, Decision or Action in the product without a distinct Control Plane object.

## Decision requests and known gaps

- [Decision Request 004](../cto-decision-requests/004-product-presentation-fields.md) requests separate state unit plus integration provider/last-sync display fields.
- API routes and authenticated server handlers are not yet available in this worktree.
- Connection initiation remains server-side and intentionally has no browser implementation.

## Recommendation

**YELLOW.** The typed API binding and product boundaries are GREEN, but persistent founder workflows remain blocked on Dev-A endpoint availability and Decision Request 004 for the additional display fields.
