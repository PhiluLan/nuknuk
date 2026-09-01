# API conventions

API v1 is rooted at `/api/v1`, uses JSON, ISO-8601 timestamps, opaque IDs, cursor pagination, and RFC 9457-style problem responses. Mutations/actions require idempotency keys. Supabase tables are not the public API.

Initial resources: companies, agents, organization nodes, state observations, evidence, findings, objectives, tasks, decisions, approvals, actions, outcomes, integrations, events, audit events, usage, and health.
