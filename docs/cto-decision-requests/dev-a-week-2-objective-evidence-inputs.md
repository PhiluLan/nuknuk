# CTO Decision Request — Dev A Week 2 Objective and Evidence Inputs

## Status

**Pending CTO decision.** No canonical contract has been changed by Dev A.

## Decision needed

Decide whether to add the following optional fields to new, additive mutation contracts:

1. `CreateObjectiveV2`: `targetDate` and `successMeasureRefs`.
2. `RecordEvidence`: `freshnessSeconds`, `contentHash`, and lineage/source-version references.

## Why this is needed

The existing, frozen `CreateObjective` contract intentionally carries only title,
description and optional organization-node owner. The persistent Objective model
already has `target_date` and `success_measure_refs`, but the server cannot accept
those values through a canonical client transport shape without changing shared
contracts.

Likewise, `evidenceSchema` is sufficient for the current server seam and
Decision-002 classification mapping, but it omits evidence freshness, content hash
and lineage that the Blueprint identifies as canonical evidence metadata.

## Safe interim behavior

- `CreateObjective` persists title, description and owner only; target date and
  measure references remain unset.
- Evidence persists the frozen type/source/content-pointer/collection/confidence/
  classification fields only.
- Neither omission changes authority, approval, execution, tenant scope, audit, or
  RLS behavior.

## Proposed constraints if approved

The new fields remain tenant/company-scoped, server-validated and audit-coupled.
They do not introduce authority, credential, service-role, execution, or
Backyrd-specific input. Existing frozen contracts remain compatible.
