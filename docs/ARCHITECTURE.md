# Architecture

## Three planes

| Plane        | Responsibility                                                      |
| ------------ | ------------------------------------------------------------------- |
| Control      | tenancy, identity, governance, authority, approvals, audit, secrets |
| Intelligence | scoped context, analysis, findings, recommendations, challenges     |
| Execution    | authorized, allowlisted, idempotent external actions                |

The release core loop is `Observe → Understand → Find → Challenge → Decide → Authorize → Delegate → Act → Measure → Learn → Audit`.

## Domain boundaries

`domain` owns vocabulary, invariants, and lifecycle definitions. `api-contracts` owns transport validation. `db` owns persistence and RLS. `runtime` may propose structured outputs but cannot grant authority. `integrations` executes only an already authorized action envelope. `web` composes product views and calls services; `worker` consumes durable jobs.

## Tenant rule

All tenant-owned records carry `tenant_id`; every access path must constrain it. RLS is deny-by-default. The Supabase service role is server-only and is never an agent identity.

## Change control

Material boundary changes require an ADR. See [ADR index](adr/README.md), [API conventions](api/README.md), and [environment runbook](runbooks/environment-strategy.md).
