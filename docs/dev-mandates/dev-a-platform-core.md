# Senior Developer Mandate — Dev A: Platform / Company Core

## Ownership

Own tenancy, membership, SQL migrations, RLS, company graph, constitution/policy, authority evaluation, work/decision/approval/audit/event/usage persistence and API service seams. You are accountable for deterministic Control Plane correctness.

## Do not touch without CTO review

Do not independently change runtime behavior, model/provider contracts, UI transport/API shapes, shared domain vocabulary, or introduce Backyrd-specific code. Do not apply an unreviewed migration anywhere. Never use Production credentials.

## Week 1 objective

Deliver the reviewed foundation whereby a human can create a tenant/company, organization node, and agent under a tenant-scoped identity, with negative cross-tenant access tests. Freeze the minimal persistence/API contract jointly with the CTO before dependent work starts.

## Required outputs

1. Reviewed additive SQL migration plan and initial schema for tenant, company, membership, organization node, agent and audit/event minimums.
2. Deny-by-default RLS and composite tenant integrity constraints.
3. Server-side service/API seam that validates canonical contracts; no direct client governance writes.
4. Migration-from-empty and RLS isolation tests, including PostgREST/direct-access negative cases.
5. ADR or PR compatibility note for every shared contract change.

## Acceptance criteria

- Two test tenants cannot read, infer, create cross-links to, or mutate each other’s data.
- Each tested mutation writes an auditable event in the same transaction.
- Agent identity is tenant/company scoped; it is not a service-role or shared human account.
- `pnpm lint`, `typecheck`, `test`, and `build` remain green.
- A clean environment can execute migrations; no destructive migration is introduced.

## Handoffs

At 24 hours: propose schema and RLS contract to CTO. At 48 hours: present migration/RLS evidence, the frozen Week-1 API seam, known gaps and an integration smoke result to Dev B/C and CTO.

## 48-hour integration review

Bring migration diff, RLS test output, contract diff, audit evidence, and a runnable smoke path. A yellow/red CTO result blocks dependent schema assumptions until remedied.
