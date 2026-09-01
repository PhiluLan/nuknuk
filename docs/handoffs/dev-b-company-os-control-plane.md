# Dev B handoff: Company-OS Control Plane

Runtime never writes PostgreSQL directly. It passes its already-scoped run result to the server-side `CompanyOSControlPlaneService`.

- `reserveAgentRun` is idempotent by tenant, company, operation and key. It creates the `agent_runs` row, reservation, audit event and domain event atomically. A duplicate returns the original run ID.
- `transitionAgentRun` re-checks `(tenant_id, company_id, agent_id, run_id)` and accepts only the persisted lifecycle transitions. Each transition creates audit and domain events.
- `run_context_manifests` stores a pointer/hash and evidence references. Do not place raw prompts, credentials, or provider payloads in it.
- `usage_records` is append-only and scoped to tenant/company/agent/run. Runtime reports normalized usage to the application service; it does not insert records itself.
- Runtime output remains proposal-only. Provisioning an agent grants no authority. Persisted authority evaluations are `allow`, `require_approval`, or `deny`; missing evaluator data fails closed to `deny`.

All references must match the original tenant/company/agent scope. A scope mismatch, duplicate reservation, or illegal transition is a control-plane rejection, not a runtime recovery path.
