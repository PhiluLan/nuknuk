# Dev A → Dev B Runtime Persistence Handoff

## Status

Required before runtime proposals can become durable product records. Dev B has intentionally not implemented these concerns.

## Requested contracts

1. **AgentRun persistence:** tenant/company/agent-scoped record, canonical lifecycle transition ownership, trigger/purpose, manifest reference/hash, and run correlation ID.
2. **Idempotency reservation:** atomic tenant/company/agent-scoped reservation keyed by the trigger idempotency key; returns existing run ID on duplicate without allowing a second run.
3. **Usage ledger:** immutable server-side usage/cost append interface associated with the persisted run and provider normalized units.
4. **Audit/event append:** immutable server-side audit and outbox interface for run creation, terminal transitions, and output handoff. The runtime must not write these directly.
5. **Proposal handoff:** an application service that validates `AgentRuntimeOutput` scope and then routes recommendations/proposed tasks/proposed actions to control-plane evaluation. It must not create a Decision or Action from runtime output automatically.

## Exact boundary

Dev B supplies a validated, scope-bound proposal at `awaiting_authority`. Dev A owns transactional persistence, audit, usage, idempotency durability, authority evaluation, and every state mutation.
