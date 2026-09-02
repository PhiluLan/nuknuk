# Dev B Handoff — Week 2 AgentRun Control Plane

## Boundary

Runtime calls the server-owned `ControlPlaneService` through a server RPC adapter.
Runtime never imports SQL, receives a database client, uses a Supabase role, calls
an integration, or decides authority.

All calls carry the verified initiating human `ServerActor`; the Control Plane
rechecks active membership plus tenant/company/agent/run scope at the SQL boundary.

## Required call order

1. `reserveAgentRun(actor, { tenantId, companyId, agentId, runId, triggerRef,
idempotencyKey })`
   - Unique by tenant/company/`agent_run`/idempotency key.
   - First call returns `accepted: true`; a retry returns `accepted: false` and the
     original run ID.
   - Persists queued run, reservation, AuditEvent and DomainEvent atomically.
2. `transitionAgentRun(... assembling_context)`.
3. `attachRunContextManifest(...)` only while the run is `assembling_context`.
4. `transitionAgentRun(... running)`.
5. `recordUsage(...)` for each attributable provider/model usage record.
6. `persistAwaitingAuthorityOutput(...)` with the canonical
   `AgentRuntimeOutput` and a durable output pointer.
   - The service validates `run_id`, `tenant_id`, `company_id`, and `agent_id`
     against the reserved run before persistence.
   - It writes `awaiting_authority` plus a proposal record, audit and domain event.
   - It does **not** create a Decision, ApprovalRequest, Task, Action, or authority
     grant.

## Legal transitions

- `queued → assembling_context | cancelled | blocked`
- `assembling_context → running | cancelled | failed | blocked`
- `running → awaiting_authority | completed | failed | cancelled | timed_out | blocked`
- `awaiting_authority → completed | failed | cancelled | blocked`

Any other transition or any scope mismatch is rejected transactionally. Usage is
immutable; manifest updates are controlled and auditable. Runtime must stop at the
proposal handoff.
