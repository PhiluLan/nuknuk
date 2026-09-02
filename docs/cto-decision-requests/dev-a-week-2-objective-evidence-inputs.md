# CTO Decision 005 — Dev A Objective and Evidence Inputs

## Status

**Approved and implemented.** `CreateObjective` remains frozen and unchanged.

## Decision needed

Decision 005 approved the following additive canonical mutation contracts:

1. `CreateObjectiveDetailed`: the existing Objective input plus optional
   `targetDate` (`YYYY-MM-DD`) and `successMeasureRefs` (defaulting to `[]`).
2. `RecordEvidence`: tenant/company-scoped Evidence input with optional
   `freshnessSeconds`, structured SHA-256 `contentHash`, opaque non-secret
   `sourceVersionRef`, and `parentEvidenceRefs` (defaulting to `[]`).

## Why this is needed

The existing, frozen `CreateObjective` intentionally carries only title,
description and optional organization-node owner. `CreateObjectiveDetailed` maps
to the same Objective application service and preserves that compatibility while
allowing the persistent `target_date` and `success_measure_refs` fields to be set.

`RecordEvidence` adds the evidence freshness, content hash, source-version and
lineage metadata required by the Blueprint without exposing persistence entities.

## Enforced constraints

- `targetDate` is a real ISO-8601 calendar date; success-measure references must
  resolve to Metrics within the same tenant and company.
- Evidence parents must resolve in the same tenant/company; self-lineage and
  cross-scope lineage are rejected by constraints and service-owned persistence.
- `contentHash` is only `{ algorithm: "sha256", value: <64 lowercase hex> }`.
  Source-version metadata rejects credential-shaped values.
- `verified_system_data` is denied by default at the application boundary. An
  explicit trusted-ingestion authorizer is required; recording Evidence never
  grants Authority or execution capability.
- Each mutation remains idempotent, tenant-scoped, audit/event-coupled and
  protected by forced RLS. Existing frozen contracts remain compatible.
