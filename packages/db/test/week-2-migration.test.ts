import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("week 2 migration adds service-only, idempotent, tenant-scoped control-plane seams", async () => {
  const migration = await readFile(
    new URL(
      "../../../supabase/migrations/20260902193728_week_2_control_plane_services.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const functionName of [
    "create_agent_charter_version",
    "create_objective",
    "record_evidence",
    "record_state_observation",
    "attach_run_context_manifest",
    "record_usage",
    "persist_awaiting_authority_output",
  ]) {
    assert.match(migration, new RegExp(`function app\\.${functionName}`));
    assert.match(
      migration,
      new RegExp(`revoke all on function app\\.${functionName}`),
    );
  }
  assert.match(
    migration,
    /alter table public\.mutation_receipts force row level security;/,
  );
  assert.match(
    migration,
    /unique \(tenant_id, company_id, operation, idempotency_key\)/,
  );
  assert.match(
    migration,
    /foreign key \(tenant_id, company_id, owner_organization_node_id\)/,
  );
  assert.match(migration, /runtime output scope mismatch/);
  assert.match(migration, /agent_run\.awaiting_authority/);
  assert.match(migration, /grant execute .* to service_role/);
  assert.doesNotMatch(migration, /grant execute .* to authenticated/);
});

test("Decision 005 migration validates scoped objective measures and immutable evidence lineage", async () => {
  const migration = await readFile(
    new URL(
      "../../../supabase/migrations/20260902200820_decision_005_objective_evidence_contracts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /function app\.create_objective_detailed/);
  assert.match(
    migration,
    /success measure reference is outside the requested tenant\/company scope/,
  );
  assert.match(migration, /create table public\.evidence_lineage/);
  assert.match(migration, /check \(evidence_id <> parent_evidence_id\)/);
  assert.match(
    migration,
    /parent evidence reference is outside the requested tenant\/company scope/,
  );
  assert.match(migration, /evidence cannot reference itself as lineage/);
  assert.match(migration, /content hash must be a sha256 hex digest/);
  assert.match(
    migration,
    /alter table public\.evidence_lineage force row level security;/,
  );
});
