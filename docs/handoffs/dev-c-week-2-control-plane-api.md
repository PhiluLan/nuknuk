# Dev C Handoff — Week 2 Control Plane API

## Safe server bindings

Bind browser code only through a host-side authenticated adapter around
`FoundationService` and `ControlPlaneService`. The adapter must derive the human
actor from the verified server session; it must never accept actor, service-role,
authority result, credential, tenant/company override, or execution input from the
browser.

Available server methods:

- Onboarding: `bootstrapFounder`, `createCompany`, `createMembership`,
  `createOrganizationNode`, `createAgentCharterVersion`, `provisionAgent`.
- Reads: `organizationGraph(actor, scope)`, `agentDetail(actor, scope)`,
  `companyStateCards(actor, scope)`, `objectives(actor, scope)`, and
  `awaitingAuthority(actor, scope)`.
- Writes: `createObjective`, `recordEvidence`, and `recordStateObservation`.

The narrow framework-neutral handlers currently mature enough for host routing are:

- `POST /api/v1/objectives`
- `POST /api/v1/evidence`
- `POST /api/v1/state-observations`

They require an authenticated server actor and an `Idempotency-Key` header. Errors
are RFC-9457-style `application/problem+json`; no table entity is returned.

## Presentation rules retained

`AwaitingAuthorityView` is a persisted Decision-002 proposal only. It is not a
Decision, approval, Task, Action, or authority result. Capability and authority
strings are descriptive and do not grant browser permissions.

## Still unavailable / fixture-only

- Browser-facing Next.js route mounting and session extraction (must be composed by
  the application host; Dev A does not alter Dev C-owned web code).
- Integration connection persistence: only the safe `not_configured`,
  `server_initiated` projection seam exists.
- Objective target date/success-measure input and extended evidence metadata await
  [CTO Decision Request](../cto-decision-requests/dev-a-week-2-objective-evidence-inputs.md).
