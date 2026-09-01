# Environment strategy runbook

## Current declaration

- Production Supabase project: `eblhbecovxgyiwpozelg` (`https://eblhbecovxgyiwpozelg.supabase.co`)
- Staging Supabase project: `yhtbcrlwpibtggwqrsnq` (`https://yhtbcrlwpibtggwqrsnq.supabase.co`), region `eu-central-2`
- Local: local Supabase or a separate isolated development project; never Production

## Safety checks

1. Confirm environment name before any migration or integration connection.
2. Use environment-scoped secrets in deployment/CI; never reuse Production secrets in local or Preview.
3. Apply migrations to a clean local database and Staging before a reviewed Production plan.
4. Verify backup/PITR, owner, RPO/RTO, rollback and kill-switch paths before customer data.

## Staging provision checklist

Founder creates `nuknuk-staging`; records project reference, URL, region, owner, billing/plan and backup capability; then gives the CTO/project deployment owner access through the Supabase dashboard. No key should be pasted into an issue, mandate, repository, or chat.
