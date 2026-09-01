# DEV-C WEEK-1 REPORT — Product / Command Center / Integrations

## Delivered

- Typed, responsive product shell with hash-routed views and keyboard skip link.
- Company setup, organization-node creation and draft-agent creation/view flow.
- Command Center foundation for approvals, work, audit and cost surfaces.
- Integration configuration seam presenting capability, scope and health without a credential field or client-side secret storage.
- Explicit loading, empty, error and unauthorized screen states.

## Routes and screens

| Route                 | Screen                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| `/onboarding/company` | Tenant-generic company setup                                             |
| `/organization`       | Company context and organization-node create/view                        |
| `/agents/new`         | Draft agent creation, scoped to an organization node                     |
| `/command-center`     | Agent list plus approval/work/audit/cost placeholders                    |
| `/integrations`       | Capability/scope/health seam; configuration disabled pending server flow |

## View/API assumptions

The browser speaks only to the `ProductService` interface. It is a temporary view-model boundary, not a new public API contract. It needs a CTO-approved, authenticated `/api/v1` replacement after Decision Request 001 is resolved. Company and agent identifiers are opaque strings; authority, activation and configuration connection are server-controlled.

## Fixtures vs. real contracts

`FixtureProductService` is explicitly synthetic and in-memory. Its values are disposable and contain no credentials. The fixture is the only implementation currently bound to the shell. Canonical Zod contracts were neither changed nor duplicated.

## Accessibility and responsive checks

- Semantic `main`, labelled navigation, current-route marker, form labels, native required validation, keyboard-visible focus, and skip link are present.
- State messages use `role=status` and `aria-live=polite`.
- The shell changes from a two-column navigation layout to a single-column layout at 720px; summary cards collapse to one column.
- Automated smoke tests cover the onboarding fixture flow and unavailable-state rendering. Manual browser verification is still required once a web host is chosen.

## Security boundaries

- No Supabase client, table query, service-role credential, secret field or privileged browser capability exists in `apps/web`.
- No Backyrd-specific code, data, policy, metric, copy or branch was added.
- Integration configuration has no raw-secret input and remains unavailable until a server-side flow is approved.

## Contract diffs

None. No core DB/RLS, authority, runtime or shared API contract changed.

## Risks and gaps

1. `NUKNUK_TECHNICAL_EXECUTION_BLUEPRINT_v1.0.md` was not present in the repository and could not be read.
2. Decision Request 001 blocks binding this UI to real create/read endpoints.
3. The workspace currently has no committed history and no selected browser host/bundler; the shell is exported and testable but needs host integration for a visual browser smoke run.
4. Authenticated identity, server validation, persisted audit events, integration OAuth/connect flow, and real approval/work/audit/cost data depend on Dev A's reviewed service seam.

## Dependencies

- **Dev A:** approved authenticated `/api/v1` company/bootstrap, organization-node, agent and integration-configuration view/mutation contracts, including RFC 9457 error mapping and least-privilege authorization outcomes.
- **Dev B:** presentation-safe, tenant-scoped run/usage/health view models for Command Center work, audit/cost and agent status surfaces; no runtime output or authority decision is consumed yet.

## UI test plan and runnable smoke path

1. Run `pnpm test` with Node 22; this executes the automated Company → Organization Node → Agent fixture smoke test.
2. Mount `ProductApp` to an `#app` element in the chosen web host.
3. Navigate to **Company setup**, submit valid values, then create an organization node and a draft agent.
4. Confirm the draft agent appears in **Command center** and integration configuration has no credential field.
5. Verify keyboard navigation, skip link and focus treatment; check the 720px responsive layout; inject a failing service to verify error and unauthorized states.

## Recommendation for the 48-hour CTO integration review

**YELLOW.** The isolated UI foundation and quality checks are green, but integration must remain blocked until the missing Blueprint is supplied and Decision Request 001 plus Dev A's authenticated API seam are approved.
