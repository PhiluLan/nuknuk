# CTO Decision Request 004 — Product Presentation Fields

## Status

Approved by CTO Decision 004 on 2026-09-02.

## Decision needed

Decide whether to add the following fields to the already approved product contracts:

1. `CompanyStateCardView.unit` — a separately labelled display unit rather than embedding it into `displayValue`.
2. `IntegrationConnectionView.provider` — provider label distinct from connection name.
3. `IntegrationConnectionView.lastSyncAt` — ISO-8601 timestamp or explicit absent state.

## Why this is needed

The Week-2 UI mandate requires these display elements. Current Decision-003 contracts provide `displayValue`, `name`, capability/scope/health, but no distinct unit, provider or last-sync field. Inferring them from persistence or adding shadow browser fields would break the product/API boundary.

## Current safe behavior

The UI renders the approved `displayValue` verbatim and displays approved integration name, health, capabilities and scope. It does not fabricate a unit, provider or sync timestamp.
