# Dev C handoff: Company-OS server boundary

Safe to bind once the server API adapter is reviewed:

- tenant/company/membership/organization/agent creation through the frozen Decision-001 contracts;
- tenant-filtered reads of organization, agent, state, evidence, objectives, decisions, approvals, tasks, audit and usage;
- read-only run status and approval state.

Not available to browser/UI code:

- direct table writes or Supabase service-role access;
- agent-run reservation/transition, context manifests, usage writes, authority grants/evaluations, or approval/decision/task state changes;
- credentials, agent identity capabilities, raw evidence artifacts, and authority-policy internals.

All future mutations use a reviewed server API adapter. The UI must not construct authority outcomes, set ownership metadata, or substitute tenant/company scope.
