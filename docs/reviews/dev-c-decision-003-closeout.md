# DEV-C DECISION-003 CLOSEOUT REPORT

## Recommendation

**GREEN for the approved Product/API contract layer and Dev-C service alignment.** Binding to real server endpoints remains dependent on Dev A's authenticated, tenant/company-scoped application services.

## Contract diff

Added exactly the eight Decision-003 canonical product contracts in `@nuknuk/api-contracts`:

1. `OrganizationGraphView`
2. `AgentDetailView`
3. `CompanyStateCardView`
4. `ObjectiveView` and `CreateObjective`
5. `AwaitingAuthorityView`
6. `IntegrationConnectionView`
7. `CreateOrganizationNode`
8. `CreateAgentCharterVersion`

All views carry tenant/company scope. The contracts are denormalized product projections, not table shapes. Mutations deliberately omit authority outcomes, credentials, execution fields, and persistence-owned identifiers. `AwaitingAuthorityView` validates that the canonical runtime output has the same run, tenant, company, and agent scope as its presentation envelope.

## Screens affected

- Organization, agent detail, company state, objectives, command center and integrations now have approved view-model counterparts in `ProductService`.
- Organization node and objective creation now submit the approved scoped mutation shapes.
- Agent provisioning continues to use frozen Decision-001 `ProvisionAgent`; the approved charter-version mutation is exposed on the service boundary for server binding without inventing a browser authority flow.

## Tests

- Positive contract tests cover every approved projection and mutation.
- Negative tests reject missing scope, authority/approval fields, service-role/credential/execution-shaped fields, and scope-mismatched or approval-shaped awaiting-authority projections.
- Web smoke tests validate that `FixtureProductService` emits parseable Decision-003 views.

## Remaining dependencies

- **Dev A:** authenticated `/api/v1` handlers, idempotency keys, RFC-9457 problem responses, server-side tenant/company/owner authorization, and persisted read projections.
- **Dev B:** persisted, presentation-safe runtime/run/usage projections feeding `AwaitingAuthorityView`; no runtime proposal may become a Decision, approval, or Action in the UI without separate Control Plane objects.

## Boundaries retained

No direct Supabase access, DB/RLS change, client secret, service-role information, client-side authority evaluation, approval outcome, execution capability, or customer-specific branch was added.

## Git status

The repository baseline remains untracked and has no commit history. No files were staged, committed, or pushed.
