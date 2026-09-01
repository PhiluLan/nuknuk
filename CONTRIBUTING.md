# Contributing to nuknuk

## Non-negotiable rules

- Every tenant-owned record is tenant-scoped; RLS is the final data boundary.
- `packages/domain` stays pure: no UI, framework, provider, or database imports.
- Shared domain names, lifecycle changes, API shapes, and authority semantics require an ADR and CTO review.
- SQL migrations are additive/expand-contract, reviewed, and never applied to Production without explicit approval.
- No Production secret is used locally or committed. No raw provider/integration credential reaches a browser or agent prompt.
- Backyrd is tenant configuration only. Do not introduce Backyrd-specific product branches.

## Before requesting review

Use Node 22 and the repository-pinned pnpm 10.17.1 through Corepack. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Include migration/RLS evidence when database code changes, and describe contract changes and their compatibility impact.

## Integration cadence

Every 48 hours, the CTO reviews merge state, contract and migration diffs, RLS/API checks, an end-to-end smoke path, queue/cost failures, and scope. Dependent work may not proceed on an assumed, unreviewed contract.
