# Dev A → Dev B Runtime Persistence Handoff

## Status

The runtime now exposes `AgentRunApplicationService`, a service-facing adapter that mirrors this handoff without importing `@nuknuk/db`. Dev A supplies its server-side implementation.

## Requested contracts

1. **Run reservation:** atomically reserve `(tenant_id, company_id, agent_id, run_id, idempotency_key, trigger_ref, audit_correlation_id)` and return the existing run ID for a duplicate.
2. **Lifecycle transition:** atomically persist only reviewed lifecycle transitions with the same scope and audit correlation.
3. **Context manifest pointer:** persist only a pointer/hash and evidence references; never raw prompts, provider payloads, or secrets.
4. **Usage persistence:** append normalized input tokens, output tokens, and estimated cost under the same scope/run/audit correlation.
5. **Awaiting-authority persistence:** write a validated proposal only after the runtime has reached `awaiting_authority`; no automatic Decision or Action creation.
6. **Audit correlation:** couple reservation, transitions, manifest pointer, usage, and proposal handoff to the supplied immutable correlation ID.

## Exact boundary

Dev B supplies a validated, scope-bound proposal at `awaiting_authority`. Dev A owns transactional persistence, audit, usage, idempotency durability, authority evaluation, and every state mutation.
