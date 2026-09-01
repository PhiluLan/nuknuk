# ADR 0002: Environment and Supabase strategy

## Status

Accepted

## Decision

| Environment | Supabase project                        | Data policy                                   |
| ----------- | --------------------------------------- | --------------------------------------------- |
| Local       | local Supabase or isolated dev project  | synthetic/test credentials only               |
| Preview     | isolated/sandbox configuration          | synthetic tenant data only                    |
| Staging     | `yhtbcrlwpibtggwqrsnq` (`eu-central-2`) | integration dry-run/sandbox or read-only data |
| Production  | `eblhbecovxgyiwpozelg`                  | protected customer operation only             |

Production credentials are not permitted in development, CI logs, browser bundles, prompts, or source control. Production migrations require review and an approved plan; they are never run automatically by this repository baseline.

## Staging follow-up required

The separate `nuknuk-staging` project has been provisioned. Enter its environment-specific credentials only in the protected staging deployment/CI secret store. Enable appropriate backups/PITR before customer data, and grant least-privilege access to the engineering deployment identity.
