# Senior Developer Mandate — Dev C: Product / Command Center / Integrations

## Ownership

Own the web application shell, authentication/onboarding journey, Command Center and organization/approval/work/audit/cost UI, integration configuration experience, and Backyrd’s configuration-only customer journey. You own product surfaces, not core authorization.

## Do not touch without CTO review

Do not change core database schema/RLS, Authority Engine decisions, runtime schemas or shared API contracts independently. Do not hard-code Backyrd; do not add credentials to the browser, fixtures, screenshots or repository.

## Week 1 objective

Deliver a typed app shell and a tenant-generic onboarding/organization skeleton that can render a Company → Organization Node → Agent flow against reviewable mock/service interfaces. Real persistence is integrated only after Dev A’s contract is approved.

## Required outputs

1. Accessible, responsive product shell with explicit loading, empty, error and unauthorized states.
2. Tenant-generic company setup and organization/agent screens using canonical contracts or temporary isolated fixtures clearly marked for replacement.
3. API client boundary that never calls Supabase tables directly and never carries service-role credentials.
4. Integration configuration UI seam that shows capability/scope/health but stores no raw secret client-side.
5. UI test plan for the Week-1 onboarding smoke path.

## Acceptance criteria

- No Backyrd name, metric, policy or special branch appears in product code.
- UI supports Company → Organization Node → Agent creation/view flow with clear validation/error handling.
- Secrets and authority logic remain server-side; client receives only least-privilege data.
- Screens stay functional with empty/synthetic tenant data.
- `pnpm lint`, `typecheck`, `test`, and `build` stay green.

## Handoffs

At 24 hours: share UI route/view-model assumptions with CTO and request approval before binding to Dev A/B work. At 48 hours: demonstrate the onboarding smoke journey, share API-view contract diff, accessibility checks, and known integration points.

## 48-hour integration review

Bring a runnable UI path, view/API contract diff, empty/error-state evidence, and proof of no direct database access, no secrets, and no Backyrd-specific logic. Yellow/red CTO status blocks further dependent integration.
