# DEV-C DECISION-004 CLOSEOUT REPORT

## Commit

Pending commit on `dev-c/product-command-center`.

## Contract diff

Only the approved Decision-004 fields were added:

- `CompanyStateCardView.unit` — required presentation/semantic unit, separate from `displayValue`.
- `IntegrationConnectionView.provider` — required descriptive provider label.
- `IntegrationConnectionView.lastSyncAt` — optional nullable ISO-8601 timestamp; absence means no known sync timestamp.

No other shared contract changed.

## ProductService and UI

Fixture and API ProductService implementations now retain and validate all three fields. Company State renders unit alongside its display value. Integrations render provider, health, capability/scope, and `No known sync` when `lastSyncAt` is absent. No integration secret, token, credential identifier, service role, or execution detail is displayed.

## Tests

- Contract validation requires `unit`.
- Integration validation accepts absent/null `lastSyncAt` and rejects a malformed timestamp.
- Company State smoke coverage verifies separate unit display.
- Integration smoke coverage verifies provider, absent sync handling, and no secret-shaped presentation.

## Recommendation

**GREEN for Decision-004 implementation.** Persistent API binding remains **YELLOW** pending Dev-A endpoint availability, as recorded in the Week-2 real-binding handoff.
