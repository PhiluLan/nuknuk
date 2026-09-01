# NUKNUK TECHNICAL EXECUTION BLUEPRINT

## 6 WEEK FOUNDING RELEASE — CTO MASTERPLAN v1.0

**Status:** Founder/CTO approval draft — binding once approved  
**Purpose:** The technical operating paper for the Founding Release (R0.1)  
**Target:** Investor-grade, real Customer-Zero operation in six weeks  
**Customer Zero:** Backyrd, configured only through public nuknuk capabilities  
**Repository:** https://github.com/PhiluLan/nuknuk  
**Supabase project:** https://eblhbecovxgyiwpozelg.supabase.co  
**Local development root:** `/Users/philippjohanna/dev/nuknuk`  
**Product:** The operating system for AI-native companies

---

## 1. Mandate and Executive Technical Decision

nuknuk is not a multi-agent chat application and not a prompt library. It is a multi-tenant control plane that lets a company define, run, supervise, and govern a digital organization.

**Binding architectural decision:**

> The model reasons. nuknuk controls.

An LLM may interpret evidence, generate findings, challenge a proposal, plan work, or recommend an action. It may never be the enforcement point for authorization, budget, approval, tenant isolation, secret access, or audit integrity.

The Founding Release delivers one real, end-to-end loop:

```text
Observe → Understand → Find → Challenge → Decide → Authorize →
Delegate → Act → Measure → Learn → Audit
```

The system must be small, but every link in this loop must be real. A mock approval, uncontrolled tool call, shared tenant state, or untraceable decision is a release blocker.

### 1.1 Three planes

| Plane                       | Responsibility                                                                                | Character                                    | LLM authority                                       |
| --------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Deterministic Control Plane | identity, tenancy, governance, budgets, approvals, entitlement, audit, secrets, kill switches | deterministic application and database logic | none                                                |
| Intelligence Plane          | context assembly, analysis, synthesis, recommendations, challenges, confidence                | probabilistic                                | proposes structured outputs only                    |
| Execution Plane             | integration calls, action dispatch, webhooks, scheduled work                                  | controlled side effects                      | executes only an already-authorized action envelope |

**Invariant:** Intelligence proposes; Control authorizes; Execution performs. Every transition produces an immutable audit event.

### 1.2 CTO GO / NO-GO

**CTO position: GO**, subject to this blueprint and its acceptance gates.

**Automatic NO-GO conditions:**

- tenant isolation, secret isolation, authority enforcement, or audit integrity are missing or bypassable;
- Backyrd requires product-core special code rather than configuration/API use;
- agents can call privileged tools directly with raw credentials;
- production has no tested migration, rollback, backup, monitoring, or kill-switch path;
- the end-to-end loop is staged/faked instead of persisted and verifiable.

---

## 2. Founding Release Scope

### 2.1 Build now — non-negotiable R0.1

1. Account, company, membership, and isolated tenant foundation.
2. Company setup: constitution, organization graph, roles, agent charters, reporting lines, authority and budgets.
3. Structured company state with provenance, freshness, confidence, owner, and history.
4. Evidence-backed findings, recommendations, cross-agent challenge, and executive brief.
5. Decision → approval → task/action → outcome → learning loop with a Decision Ledger.
6. Authority Engine that deterministically permits, requires approval for, or rejects a requested action.
7. One real inbound integration plus generic authenticated event ingestion; Backyrd uses the same contract.
8. Agent Runtime with scheduled/event-triggered runs, context assembly, model abstraction, cost tracking, failure handling, and global/tenant/agent pauses.
9. Founder Command Center, organization view, work/approval UX, decision/audit/cost visibility.
10. Public API v1, outbound webhooks, audit trail, metering foundation, CI/CD, monitoring, backups, and a tested launch gate.

### 2.2 Architect now; build later

Stable extension points must exist, but no full feature is required for: Stripe billing collection; multiple model providers; OAuth connection catalogue; Slack/email/calendar adapters; enterprise SSO/SCIM; advanced notification routing; templates; broader analytics/finance adapters; MCP adapters; vector search scale-out; policy version migration UX; model fallback routing.

### 2.3 Explicitly defer

No HRIS, payroll, accounting, CRM, Slack replacement, IDE, mobile app, marketplace, autonomous banking, contract signing, cross-customer intelligence, arbitrary code execution, broad marketplace integrations, or “always-on” agent swarm. These are not R0.1 shortcuts; they are intentionally absent.

---

## 3. Architecture Principles

1. **Multi-tenant from day one.** Every business record has `tenant_id`; database RLS is the final tenant boundary.
2. **Configuration, not customer code.** Backyrd is a tenant configuration. Customer-specific core branches are forbidden.
3. **Structured state over chat history.** Conversation text is an artifact, never the canonical company truth.
4. **Evidence before assertion.** A finding has explicit evidence references and calibration; repetition is not corroboration.
5. **Software-enforced authority.** Prompt text is advisory. The Authority Engine decides.
6. **Append-only accountability.** Audit, decision revisions, event envelopes, usage, and high-risk execution records are immutable.
7. **Least privilege and narrow blast radius.** Identity, token, tool capability, data scope, approval scope, and spend limit are separately constrained.
8. **Idempotent event processing.** At-least-once delivery is expected; state changes and external execution must tolerate retries.
9. **API-first but product-led.** UI and integrations use the same service contracts; Supabase tables are not the public API.
10. **Cost-aware autonomy.** Every run, model request, and external tool action is measurable, capped, and interruptible.

---

## 4. System Architecture and Stack

### 4.1 Recommended stack

| Layer                 | Decision                                                                                                  | Why                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Web product           | Next.js (App Router), TypeScript, React, Tailwind, shadcn/ui                                              | fast SaaS delivery, typed full-stack boundary, professional command-center UX |
| API/control plane     | TypeScript service layer in Next.js initially; domain modules independent of routes                       | quickest serious vertical slice; clean future extraction boundary             |
| Database/auth/storage | Supabase: PostgreSQL, Auth, Storage, Realtime where useful, Edge Functions only for narrow async adapters | existing project, PostgreSQL/RLS strength, reduces operational surface        |
| Schema/query          | SQL migrations as source of truth; generated TypeScript types; Kysely or Drizzle for typed queries        | RLS-safe, reviewable migrations; avoids ungoverned ORM assumptions            |
| Async jobs            | pgmq/pg_cron where available or a managed queue provider behind `JobQueue` interface                      | durable jobs and retries without in-process background work                   |
| Model provider        | OpenAI first behind a provider interface; structured JSON schema outputs                                  | quality and speed now; no provider lock-in in domain logic                    |
| Retrieval             | PostgreSQL full text + pgvector embeddings, scoped by tenant/memory policy                                | minimal secure retrieval path                                                 |
| Observability         | Sentry + structured logs + OpenTelemetry-compatible traces; Supabase logs                                 | correlate agent runs, API requests, jobs, and tool calls                      |
| Deployment            | Vercel for web/API; Supabase managed database; GitHub Actions                                             | mature, low-ops deployment path                                               |

No microservice split in R0.1. We deploy a modular monolith with strict package/domain boundaries and independent queue worker entry points. The data contracts make later extraction possible without prematurely distributing failure modes.

### 4.2 Logical components

```text
Web Command Center / Public API v1 / Webhook endpoints
                         │
                 Application Service Layer
 ┌───────────┬───────────┼───────────┬────────────┬───────────┐
 Identity    Company OS   Governance  Intelligence Integration
 / RBAC      / Work       / Authority Runtime      Gateway
 └───────────┴───────────┼───────────┴────────────┴───────────┘
                         │
       PostgreSQL + RLS + Storage + Outbox + Usage/Audit Ledger
                         │
             Durable Jobs / Scheduler / Webhook Delivery
                         │
         OpenAI │ GitHub (R0.1) │ generic inbound/outbound APIs
```

### 4.3 Repository / monorepo structure

Use `pnpm` workspaces and Turborepo. The GitHub repository is the only source of product code and deployment configuration.

```text
nuknuk/
  apps/
    web/                 # Next.js command center + API v1
    worker/              # durable job consumers / schedules
  packages/
    domain/              # pure domain types, state transitions, invariants
    db/                  # migrations, RLS tests, generated database types
    api-contracts/       # OpenAPI / Zod schemas / client types
    runtime/             # context builder, provider abstraction, run lifecycle
    integrations/        # adapter contracts and GitHub/generic adapters
    ui/                  # shared product components and design tokens
    config/              # lint, TypeScript, test configuration
  supabase/
    migrations/
    seed.sql
    functions/           # only narrow ingress/egress adapters if justified
  docs/
    adr/
    api/
    runbooks/
  .github/workflows/
```

**Rule:** `packages/domain` cannot import framework, provider, database, or UI code. State transition functions receive validated inputs and return a result/event proposal. Side effects live at the application boundary.

---

## 5. Environments, Configuration, and Release Discipline

| Environment | Purpose                                              | Data / integrations                                                    | Deployment rule                                  |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Local       | developer work at `/Users/philippjohanna/dev/nuknuk` | local Supabase or isolated dev project; test keys only                 | no production credentials                        |
| Preview     | PR validation                                        | synthetic tenant/data; sandbox adapters                                | one deployment per PR                            |
| Staging     | integration and Backyrd dry-run                      | separate Supabase project preferred; sandbox or read-only integrations | migrations first; acceptance suite required      |
| Production  | paid/customer operation                              | configured tenant integrations                                         | protected deploy, migration approval, monitoring |

Use distinct Supabase projects for staging and production before any external production data is connected. The referenced Supabase URL is registered as **production candidate only after Founder/CTO confirm its intended environment**; do not load real Backyrd credentials into a shared development project.

Configuration is validated at boot via a typed schema. Secrets never appear in client bundles, logs, job payloads, prompts, error messages, analytics, or source control. Feature flags are tenant-scoped and audited.

---

## 6. Canonical Domain Model

### 6.1 Tenancy and identity root

`tenant` represents a commercial customer boundary. `company` is the company operating inside a tenant. R0.1 uses one primary company per tenant but preserves `company_id` on domain records for future multi-company use.

```text
Tenant ──< Membership >── User (Supabase Auth)
  └──< Company ──< OrganizationNode / Agent / Policy / State / Work / Ledger
```

### 6.2 Core entities

| Entity                     | Canonical responsibility                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Tenant                     | isolation, plan/entitlement root, billing account                                                            |
| Company                    | identity, lifecycle phase, strategy, base timezone/currency                                                  |
| Membership                 | human user role within tenant/company                                                                        |
| OrganizationNode           | role/node in reporting graph; can exist without an agent                                                     |
| ReportingEdge              | `reports_to`, `delegates_to`, `challenges`, `approves`, `escalates_to`; effective-dated                      |
| Agent                      | provisioned digital worker with status, charter version and identity                                         |
| AgentCharter               | versioned mission, responsibilities, KPIs, data/tool scopes, model policy, trigger policy, forbidden actions |
| Constitution / Policy      | protected rules; versioned, approved, machine-evaluable where possible                                       |
| AuthorityGrant             | subject + action class + scope + level + budget/expiry/approval requirement                                  |
| Metric / StateObservation  | typed company state value plus provenance and history                                                        |
| Evidence                   | source, type, timestamp, freshness, confidence, content pointer/hash, lineage                                |
| Finding                    | evidence-backed observation; may create recommendation/risk/escalation                                       |
| Recommendation / Challenge | structured proposal and counter-position; not a decision                                                     |
| Decision                   | authoritative resolution with alternatives, authority, expected outcome, review date                         |
| ApprovalRequest            | immutable decision/action snapshot awaiting an authorized human or agent approver                            |
| Objective / Project / Task | native work hierarchy and ownership/dependencies                                                             |
| Action                     | authorized execution request, tool binding, idempotency key, result                                          |
| Outcome / Learning         | measured result versus expectation, confidence and captured learning                                         |
| MemoryItem                 | constitutional, strategic, operational, or learning memory with retention and retrieval scope                |
| IntegrationConnection      | tenant-owned adapter configuration and credential references                                                 |
| DomainEvent / OutboxEvent  | immutable event envelope and publish status                                                                  |
| AuditEvent                 | append-only actor/action/target/decision context record                                                      |
| UsageRecord                | attributable model/tool/runtime consumption and cost                                                         |

All entities include ULID/UUID primary keys, `tenant_id`, `company_id` where applicable, `created_at`, `created_by`, and controlled lifecycle fields. Delete semantics are soft-delete for mutable user content and append-only/redacted access for regulated audit data.

### 6.3 State machines (concrete)

| Object                | Allowed lifecycle                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent                 | `draft → active ↔ paused → archived`; `active → suspended` by control plane; no self-reactivation from suspended                                    |
| AgentRun              | `queued → assembling_context → running → awaiting_authority/awaiting_approval → completed`; terminal: `failed`, `cancelled`, `timed_out`, `blocked` |
| Finding               | `draft → published → acknowledged → resolved` or `superseded`; publication needs evidence threshold                                                 |
| Decision              | `draft → proposed → challenged → approved/rejected → executed → measured → learned`; `expired` if review window lapses                              |
| ApprovalRequest       | `pending → approved/rejected/expired/cancelled`; approved snapshot is immutable; changed intent creates a new request                               |
| Task                  | `backlog → ready → in_progress → blocked → done` or `cancelled`; completion requires outcome evidence when policy requires                          |
| Action                | `requested → authorized → dispatched → succeeded/failed/cancelled`; retries create attempts under same idempotency key                              |
| IntegrationConnection | `draft → pending_verification → active → degraded → revoked`                                                                                        |

Every transition is validated in the domain layer, persisted transactionally with an audit event and outbox event, and surfaced in the API.

---

## 7. PostgreSQL / Supabase Strategy, Tenant Isolation, and RLS

### 7.1 Database rules

- PostgreSQL is canonical for operational records. Supabase Storage holds documents/artifacts, with metadata and access policy in PostgreSQL.
- SQL migrations are ordered, reviewed, and executable in CI against a clean database and upgrade fixture.
- All tenant-owned tables contain non-null `tenant_id`; composite indexes begin with `tenant_id` for principal access paths.
- Foreign keys prevent cross-tenant references through composite `(tenant_id, id)` constraints or trigger-backed validation where necessary.
- Direct client writes are limited to narrowly approved UI tables/functions. All governance, authority, execution, secrets, decision, usage, and audit writes go through server-side application services.

### 7.2 RLS model

Supabase Auth user identity enters a transaction through `auth.uid()`. Membership tables resolve active tenant/company access. Policies are deny-by-default:

- a human may select/update only rows for tenant/company memberships and role permissions;
- service role is server-only and never exposed to browser or agent runtime;
- agent identity does not use Supabase service role; it receives a short-lived application capability context;
- `audit_events`, `usage_records`, and protected governance history are insert-only for application service; users have filtered read access;
- storage policies mirror database tenant paths: `tenant/{tenant_id}/...`.

**Required RLS acceptance test:** User A and User B from different tenants cannot read, infer, insert, update, link, or retrieve documents/embeddings from each other, using both direct PostgREST and application endpoints.

---

## 8. Auth, RBAC, Agent Identity, and Authority Engine

### 8.1 Human access

Supabase Auth handles authentication. Application RBAC governs authorization. Initial roles: `founder`, `admin`, `operator`, `viewer`, plus explicit company-scoped permissions. RBAC answers _who may use nuknuk_. It does not replace the Authority Engine, which answers _whether an organizational action may occur_.

### 8.2 Agent identity

An agent has immutable `agent_id`, tenant/company scope, charter version, lifecycle state, and a short-lived signed run capability. It has no shared human account and no long-lived provider credential. Every tool call carries: run ID, agent ID, tenant/company ID, authorized action ID, expiry, allowed adapter/method/resource scope, and idempotency key.

### 8.3 Authority Engine

The Authority Engine evaluates a proposed action against:

```text
subject identity + charter + organization relationship + constitution/policy +
authority grant + resource scope + action risk + budget/usage + approval state +
integration capability + runtime/tenant kill switch
```

Levels:

| Level                | Meaning                                       | R0.1 example                                                  |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| L0 Observe           | read permitted scope                          | read GitHub issue data                                        |
| L1 Recommend         | create proposal/finding                       | recommend a deployment investigation                          |
| L2 Internal action   | create internal work/state updates            | create task, risk flag, analysis                              |
| L3 Limited execution | allowlisted reversible external action in cap | create a GitHub issue/comment only                            |
| L4 Human approval    | requires explicitly approved action snapshot  | send consequential external update                            |
| Human only           | never agent-executable                        | banking, contracts, policy/authority elevation, secret export |

An agent cannot grant, raise, renew, or approve its own authority. Authority results are persisted as `allow`, `require_approval`, or `deny`, including rule/policy identifiers and evaluated limit values.

### 8.4 Constitution and governance

A constitution is a versioned protected policy set. It supports human-readable policy text plus structured rules where machine enforcement is feasible: spend threshold, prohibited action class, required approver role, data classification restriction, operating-market constraint.

Constitution changes require a human with defined authority, reason, diff, and audit trail; no agent-generated policy takes effect without that path. A policy evaluator fails closed: missing data means deny or require approval, never silently allow.

---

## 9. Company State, Evidence, Memory, and Decision Ledger

### 9.1 Company State

State is a typed history, not a mutable dashboard value. `StateObservation` includes metric/key, typed value/unit, dimensions, source/evidence pointer, observed and ingested timestamps, freshness window, confidence, owner, and supersession relationship. Current state is a derived projection from valid observations.

R0.1 supports numeric, currency, count, percentage, boolean, categorical, and short structured JSON values. A state write without provenance is marked `human_input` or `agent_inference`; it cannot masquerade as verified system data.

### 9.2 Evidence

Evidence types: `verified_system_data`, `human_input`, `external_source`, `agent_inference`, `insufficient_evidence`. Each evidence record stores source connector/source URI, content or artifact hash/pointer, collection time, freshness, confidence, classification, and lineage. Deduplicate source/version identity before scoring corroboration.

Findings cite evidence IDs; evidence never becomes stronger merely because multiple agents repeat it. The UI distinguishes observed fact, inference, and recommendation.

### 9.3 Memory and retrieval

Memory classes and access:

| Class          | Examples                                    | Write / retrieval controls                               |
| -------------- | ------------------------------------------- | -------------------------------------------------------- |
| Constitutional | non-negotiable rules                        | founder-authorized writes; always included when relevant |
| Strategic      | commitments and material decisions          | decision-ledger derived; high retention                  |
| Operational    | active work, project context, current state | owner/role scoped, freshness weighted                    |
| Learning       | hypothesis → decision → outcome             | outcome-backed, calibrated retrieval                     |

Retrieval is tenant-filtered before semantic search, then filtered by company, classification, agent charter scope, freshness, and token budget. The Context Builder returns citations/IDs, not an unbounded document dump. Memory writes require source/owner/retention and are auditable.

### 9.4 Decision Ledger

Every material decision records: situation, decision question, linked evidence, options, agent positions/challenges, authority basis, approver, expected outcome and date, work/action created, actual outcome, learning, and superseding decision. It is append-only by revision; corrections create a new revision with rationale.

---

## 10. Objectives, Work, Tasks, Actions, Outcomes

The canonical execution chain is:

```text
Signal/Event → Evidence → Finding → Recommendation/Challenge → Decision →
Approval (if required) → Objective/Project/Task → Action → Outcome → Learning
```

Objectives are measurable, owned, time-boxed, and tied to state metrics. Projects aggregate tasks. Tasks contain dependencies, owner (human or agent), priority, due date, execution policy, and acceptance criteria. Actions are side-effect requests and must be linked to a task/decision or an explicitly policy-allowed operational trigger. Outcomes compare actual to expected result and close the feedback loop.

An agent may create tasks only within its delegation/authority scope. External action does not equal task completion; evidence of result is required.

---

## 11. Agent Runtime and Context Assembly

### 11.1 Run lifecycle

The scheduler/event consumer creates a durable `AgentRun` with trigger, purpose, budget, idempotency key, and target scope. The worker assembles context, calls the model through the provider adapter, validates structured output, persists findings/recommendations, requests authority, and emits next events. Workers do not hold state in memory as truth.

### 11.2 Context Assembly order

1. Run mandate and trigger/event payload.
2. Tenant/company identity, agent charter/version, organization/reporting scope.
3. Applicable constitution and authority constraints.
4. Relevant objectives, work, decisions, and current company-state projection.
5. Fresh, access-allowed evidence and scoped memory retrieval.
6. Prior open findings/approval/action status.
7. Explicit output schema, cost/time ceiling, and tool capability list.

Context is compacted deterministically, with every supplied source captured as a `RunContextManifest`. The LLM output must conform to schema: claims, citations, confidence, proposed tasks/actions, and uncertainty. Free-form output may be retained as artifact but cannot directly produce state changes.

### 11.3 Executive cycle

R0.1 supports a daily scheduled executive brief and event-triggered specialist review. Specialists produce evidence-backed findings. A relevant executive agent can challenge/synthesize them. The CEO agent produces a structured brief/recommendation; the platform creates approval or work, subject to Authority Engine outcome. This is structured collaboration, not agents endlessly conversing.

### 11.4 Model abstraction and cost controls

`ModelProvider` exposes capability discovery, structured generation, embeddings, usage normalization, error classes, and cancellation. First provider: OpenAI. `ModelPolicy` is charter-configured and constrains provider/model, maximum input/output, run cost, retry and fallback policy.

Controls: per-run cap, per-agent daily cap, tenant monthly cap, queue concurrency, schedule rate limit, duplicate-run suppression, context/token budgets, anomaly alerts, and hard kill switch. Usage is recorded after every request with model, token counts, tool usage, estimated/provider cost, agent, department, company, and run.

---

## 12. Events, Schedules, Queues, API v1, and Webhooks

### 12.1 Event architecture

Domain changes create `DomainEvent` records in the same transaction as state mutation via transactional outbox. A publisher delivers events to durable queues and outbound webhooks. Consumers are idempotent by event ID + consumer key. Events contain versioned type, tenant/company IDs, actor, occurred time, causation/correlation IDs, payload reference, and classification — never secrets.

Initial event types: `state.observed`, `finding.published`, `recommendation.created`, `decision.created`, `approval.required`, `approval.resolved`, `task.assigned`, `action.authorized`, `action.completed`, `outcome.recorded`, `agent.run.failed`, `risk.detected`.

### 12.2 Schedules and queues

Schedules are tenant/agent configured, timezone-aware, policy-capped, and materialized into queued jobs. Use durable retries with exponential backoff, dead-letter records, run timeout, cancellation, and visibility into attempts. Never rely on browser sessions or serverless in-memory timers. Missed schedules are observable; no silent catch-up storm.

### 12.3 API v1 contract

Base path: `/api/v1`. JSON only, ISO-8601 timestamps, opaque IDs, cursor pagination, RFC 9457-style problem errors, idempotency keys for mutation/action endpoints, and an OpenAPI document generated/validated in CI.

Minimum resource groups:

```text
/companies                 /agents                 /agent-runs
/organization/nodes        /charters               /policies
/state/observations        /findings               /evidence
/objectives                /projects               /tasks
/decisions                 /approvals              /actions /outcomes
/integrations              /events                 /webhook-endpoints
/audit-events              /usage                  /health
```

Public API authentication is tenant-scoped personal/service API tokens with prefix, hash-at-rest, expiration, rotation, scope and audit. The browser never receives a broad API token.

### 12.4 Webhooks

Inbound: `POST /api/v1/events` verifies tenant integration identity, timestamp, HMAC signature, schema version, replay window, and idempotency key; payload lands first in an ingress ledger before processing. R0.1 generic event ingestion plus one Backyrd-relevant integration adapter (recommended: GitHub read/event integration).

Outbound delivery uses endpoint-level event subscriptions, signing secret, event ID, retry/backoff, delivery logs, disable-after-failure policy, and test event. Initial external events: `decision.created`, `approval.required`, `task.assigned`, `risk.detected`, `agent.run.failed`.

---

## 13. Integrations, Secrets, and Tool Execution

### 13.1 Integration contract

An adapter declares its capabilities, required OAuth/API scopes, supported event schemas, resource mappings, action classes, reversibility, and rate-limit behavior. The app never treats arbitrary adapter data as trusted instructions. Integration data is classified, normalized into evidence/state, and lineage preserved.

### 13.2 Secret handling

Connection secrets are encrypted at rest using platform-managed encryption/KMS capability and referenced by opaque secret IDs. They are decrypted only in the server-side adapter execution boundary. Redaction is enforced in logs, artifacts, prompts, audit payloads, telemetry, and error reporting. Rotate/revoke hooks exist per connection; revocation disables queued actions.

### 13.3 Tool execution

Tools are allowlisted adapter methods, not raw HTTP shells. A tool request must have an `Action` already authorized by the Authority Engine. The executor revalidates run capability, action status, resource scope, spend/rate cap, connection state, and kill switch immediately before dispatch. It stores request/response metadata redacted, status, external reference, and retry attempt. R0.1 permits only reversible, tightly scoped external operations; destructive/irreversible capability is Human Only.

---

## 14. Audit, Observability, Metering, Entitlements

### 14.1 Audit

`AuditEvent` records append-only actor (user/agent/system), action, target type/ID, tenant/company, IP/request/run/correlation ID, authority result, before/after summary or artifact hash, time, and reason. High-risk events include policy changes, role/authority edits, approval actions, secret connection lifecycle, data exports, tool execution, and kill-switch changes.

Audit writes are transactionally coupled to protected state transitions. The product provides searchable tenant-filtered audit UI. No audit record is silently editable; redaction is an explicit auditable event.

### 14.2 Observability

Every request/run/action has correlation IDs through API, queue, model call, tool execution, audit, and event delivery. Track errors, latency, queue lag, agent completion, unsupported claim rate, authority denies, approval age, retry/DLQ count, cost, and connector health. Alerts: abnormal cost, repeated failed action, webhook verification failures, RLS/security anomaly, queue backlog, failed backups, and agent-run crash rate.

### 14.3 Metering / billing-ready model

`Entitlement` defines plan, included allowances, limits, and feature flags at tenant level. `UsageRecord` is immutable and dimensions cost by tenant, company, department, agent, run, model, token type, tool, integration, unit, quantity, estimated cost, provider cost, and timestamp. R0.1 shows cost and usage; it does not collect payment. Limit enforcement occurs before new runs/actions, not only in reporting.

---

## 15. Frontend / Command Center Architecture

The Command Center is a decision surface, not a chat screen. It reads server-composed view models and mutations pass through typed API contracts. Client state never contains raw integration secrets or unrestricted authorization logic.

R0.1 surfaces:

- **Home / Founder Command Center:** company health, key state, active objectives, critical risks, agents working, cost today/month, and Founder Attention queue.
- **Executive Brief:** evidence, department positions/challenges, CEO recommendation, confidence, impact, approve/reject/modify/discuss flow.
- **Organization:** visual graph; role/agent status, charter, authority, direct reports, KPIs, current work, recent decisions and cost.
- **Work:** objectives, projects, tasks, dependencies, owner, state, evidence, outcomes.
- **Decisions and Approvals:** ledger history, full rationale and auditable approval flows.
- **State and Evidence:** current values, freshness, provenance, history and source links.
- **Integrations / Governance / Audit / Usage:** connection health, policies, action history and workforce cost.

Accessibility, loading/error states, empty states, and mobile-responsive reading experience are required. Full mobile-native operation is not.

---

## 16. Backyrd Customer-Zero Contract

Backyrd is a tenant, never a branch in platform logic. It must be provisioned through the same onboarding/API schema as a prospective company:

1. Create Backyrd tenant/company, founder membership, constitution and plan limits.
2. Define generic metrics (e.g., `weekly_deciding_users`, currency, source, thresholds), never Backyrd hard-coded fields.
3. Create CEO, CTO, CMO and CFO organization nodes/agent charters and reporting edges.
4. Configure authority, budgets, tool/data scopes, schedules and approval policy per role.
5. Connect the selected real integration through its published adapter and generic event contract.
6. Ingest company state with source/freshness/confidence.
7. Run daily executive cycle; expose finding, challenge, decision, approval, task/action, outcome and audit in UI.

**Customer-Zero acceptance rule:** a clean test tenant can reproduce this setup from documented public/internal product contracts without code changes. Any Backyrd exception is an issue, not a feature.

---

## 17. Security Threat Model and Blast Radius

| Threat                                    | Required control                                                                                              | R0.1 test/evidence                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Cross-tenant data access                  | RLS deny-by-default, composite tenant constraints, tenant-scoped retrieval/storage                            | automated isolation suite incl. direct DB/API attempts        |
| Prompt injection through integration data | treat external content as untrusted evidence, contextual separation, tool/authority independent of model text | malicious issue/document cannot expand tools or alter policy  |
| Stolen browser/API token                  | short expiry, hashed token, scoped API keys, rotation/revocation, no service role client-side                 | revoked token fails immediately/within documented propagation |
| Agent privilege escalation                | immutable agent identity, authority evaluator, human-only grants/constitution changes                         | agent tries self-grant/approval and is denied/audited         |
| Secret leakage                            | server-only decryption, redaction, no secret in prompts/jobs/logs                                             | log/artifact scan and connection revoke drill                 |
| Harmful external action                   | action envelope, allowlist, approval snapshot, revalidation, idempotency, kill switch                         | unauthorized and expired action cannot dispatch               |
| Replay / spoofed webhook                  | HMAC, timestamp, nonce/idempotency, ingress ledger                                                            | replay and invalid signature rejected/audited                 |
| Cost exhaustion                           | caps, rate limits, schedule control, queue concurrency, anomaly alerts                                        | cap stops run and produces visible reason                     |
| Audit tampering                           | append-only tables/RLS/service controls, revision model                                                       | attempted update/delete denied                                |
| Supply-chain/deployment compromise        | protected branches, CI checks, least-privilege deploy secrets, dependency scanning                            | PR/production access review                                   |

Blast radius is intentionally constrained: a marketing agent cannot alter GitHub production; a developer agent cannot see finance data unless a scoped policy grants it; a CFO agent cannot access unrelated sensitive data; no agent can alter its own charter authority or extract connection secrets.

---

## 18. Testing, Acceptance Gates, CI/CD, Deployment, Backups

### 18.1 Test pyramid

- Unit: domain transition/state-machine, policy/authority, schema validation, cost calculation.
- Database: migrations from empty and prior schema, RLS isolation, constraints, audit immutability.
- Contract: API/OpenAPI, webhook schemas/signature verification, adapter capability contracts.
- Integration: queue/outbox/idempotency, model provider mocked structured output, tool authorization/retry.
- End-to-end: founder onboarding through executive loop and Backyrd tenant dry-run.
- Security: token scope/revocation, injection fixture, secret-redaction fixture, permission matrix.

### 18.2 CI gates

Every pull request: format/lint, typecheck, unit suite, migration validation, RLS suite, API contract generation/diff review, dependency/security scan, build, and targeted E2E. Main branch is protected; no direct production deploy. Migrations require review by Dev A plus CTO approval for governance/security-impacting changes.

### 18.3 Deployment and rollback

Deploy immutable build artifacts through preview → staging → production. Expand/contract migrations only: ship additive schema first, deploy compatible code, backfill/verify, then contract later. Rollback application separately from data; never “rollback” a destructive migration without an approved recovery plan.

### 18.4 Backups and recovery

Enable Supabase PITR/backups appropriate to plan before customer data. Define retention, restore owner, and quarterly restore rehearsal (first rehearsal before launch if capability is available). Version and back up migration history, infrastructure config, policy exports and integration metadata; credentials are recoverable via provider rotation rather than backup export. Document RPO/RTO targets before production: provisional RPO ≤ 24h and RTO ≤ 4h pending plan verification.

---

## 19. Developer Ownership and Dependency Graph

### 19.1 Ownership

| Track                                           | Owner        | Owns                                                                                                                    | Must not independently change                                                |
| ----------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dev A — Platform / Company Core                 | Senior Dev A | tenancy, DB/RLS, company graph, constitution, authority, work/decision/audit/event/API/meters                           | runtime behavior, UI contracts, shared domain names without CTO review       |
| Dev B — Intelligence / Runtime                  | Senior Dev B | run model, context/retrieval, provider abstraction, evidence interpretation, executive cycles, queue worker, evaluation | database/RLS policy, authority semantics, UI API contract without CTO review |
| Dev C — Product / Command Center / Integrations | Senior Dev C | web product, onboarding, command center, approval/work/audit/cost UX, integration UX, Backyrd configuration journey     | core schema, RLS, authority decision, runtime schema without CTO review      |
| CTO                                             | CTO          | architecture, ADRs, shared contracts, security, database governance, integration contracts, release gates               | product scope/positioning without Founder                                    |

All shared contract changes use ADR/PR review. No track creates shadow entity definitions.

### 19.2 Dependency graph

```text
Tenant/Auth/RLS (A)
  ├─ Company Graph + Charter + Policy + Authority (A)
  │    ├─ API contracts / event outbox (A + CTO)
  │    │    ├─ Runtime context + executive cycle (B)
  │    │    └─ Command Center + onboarding + integrations UX (C)
  │    └─ Work/Decision/Approval/Audit/Usage (A)
  │         ├─ Action execution + tool adapter (B + A)
  │         └─ Decision/approval/audit/cost surfaces (C)
  └─ Backyrd configuration and end-to-end acceptance (A + B + C + CTO)
```

### 19.3 48-hour integration reviews

Every 48 hours: merge-state review, contract diff, migrations/RLS check, API schema check, end-to-end smoke test, failure/queue/cost check, and scope decision. CTO publishes one integration verdict: **green / yellow with named remedy / red stop**. No team begins a dependent feature against an unreviewed assumed contract.

---

## 20. Six-Week Sprint Plan

| Week                          | Outcome / gate                                                                      | Dev A                                                                      | Dev B                                                                | Dev C                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| 1 — Foundation                | Company → organization node → agent created under isolated tenant; contracts frozen | tenant/membership/RLS baseline, company graph migrations                   | provider/run skeleton, structured-output harness                     | app shell, auth, onboarding/command-center skeleton      |
| 2 — Company OS                | Backyrd configuration entered through product; state readable by agent              | constitution, charters, state, evidence, objectives, decisions/tasks/audit | context builder reads scoped state/memory; first analysis run        | setup, organization, agent, objective/state UI           |
| 3 — Thinking                  | Daily executive cycle creates real evidence-backed brief                            | authority checks, approval/decision transitions, event/outbox              | specialist analysis, challenge, CEO synthesis, confidence/escalation | executive brief, founder attention, approval UX          |
| 4 — Governed execution        | One real integration yields controlled task/action/outcome                          | action/usage/audit invariants, public API/webhooks                         | queue/schedules, authorized tool executor, failure/cost controls     | integration UX, work/decision/audit/cost surfaces        |
| 5 — Hardening / Customer Zero | Backyrd dry run survives real data and negative tests                               | RLS/security/migration/backups, API hardening                              | evaluation fixtures, injection/failure tests, run observability      | onboarding polish, responsive UX, acceptance walkthrough |
| 6 — Launch                    | release candidate passes launch gate; production rehearsal complete                 | release/rollback runbooks, performance/security remediation                | runtime reliability and cap tuning                                   | final command-center quality and founder demo flow       |

Week-end demos are not slideware. Each is a working deployed vertical slice in staging with a recorded acceptance result.

---

## 21. Launch Gate

R0.1 may launch only when all are true:

1. A new tenant can create a company, constitution, organization, agents/charters, authority and an objective without database intervention.
2. Tenant isolation/RLS suite and storage isolation suite pass.
3. A real inbound integration/event produces evidenced company state/finding.
4. An agent run uses scoped context and structured output; every claim displayed is cited or marked inference/insufficient evidence.
5. Executive synthesis/challenge produces a persisted decision/recommendation.
6. Authority Engine demonstrably allows, requires approval for, and denies three equivalent test actions under different policy.
7. Approved action executes via allowlisted adapter; denied/expired/replayed action cannot execute.
8. Decision → task → action/outcome → learning is visible with complete audit trail.
9. Founder sees company health, approval queue, work, audit, integration health, and per-agent/department cost.
10. API v1/webhook authentication, idempotency and schema tests pass.
11. Cost caps, tenant/agent pause, and global kill switch work in staging.
12. CI, migration, rollback, alerting, backup/PITR verification, and incident/secret-revocation runbooks are completed.
13. Backyrd passes the Customer-Zero contract without core special code.
14. Founder and CTO jointly sign launch approval after reviewing known risks.

---

## 22. Risk Register

| Risk                              | Likelihood / impact | Mitigation                                                        | Owner         | Stop condition                          |
| --------------------------------- | ------------------- | ----------------------------------------------------------------- | ------------- | --------------------------------------- |
| Scope dilutes the core loop       | high / high         | strict Build-now list and 48h scope decisions                     | CTO + Founder | adding unvalidated adjacent product     |
| Tenant/RLS mistake                | medium / critical   | RLS-first schema, negative tests, no client service key           | Dev A         | any cross-tenant leak or untested table |
| Agent overreach / tool misuse     | medium / critical   | action envelope, allowlists, approvals, revalidation, kill switch | Dev A + B     | direct tool credential or bypass path   |
| LLM unreliable/unsupported claims | high / high         | evidence schema, citations, confidence, human approval            | Dev B         | uncited claims presented as fact        |
| Queue/runtime instability         | medium / high       | durable jobs, idempotency, DLQ, timeouts, observability           | Dev B         | lost/duplicated side effect             |
| Integration complexity            | high / medium       | one adapter + generic contract, defer catalogue                   | Dev C + B     | bespoke Backyrd core integration        |
| Secrets exposure                  | low / critical      | encryption, server boundary, redaction tests, rotation runbook    | CTO           | secret appears in client/log/prompt     |
| Cost runaway                      | medium / high       | caps, schedules, queue concurrency, usage alerts                  | Dev B         | cost cap cannot halt work               |
| Parallel drift                    | high / high         | frozen contracts, ADRs, 48h reviews                               | CTO           | incompatible domain/API definitions     |
| Production recovery gap           | medium / high       | backups/PITR, expand-contract, restoration rehearsal              | Dev A + CTO   | no restore/rollback plan                |

---

## 23. Founder Decisions and Open Decisions

### Required before implementation completes

1. Confirm whether the existing Supabase project is production or staging; provision the other environment accordingly.
2. Choose Backyrd’s first real integration and its exact permitted R0.1 action. CTO recommendation: GitHub read/event ingestion; external write limited to creating an issue/comment after approval.
3. Approve initial constitution defaults: spend threshold, prohibited action classes, data classifications, required founder approvals, and default agent budget.
4. Confirm initial human product roles and who holds Founder approval authority for Backyrd.
5. Confirm preferred deployment account/domain ownership and production observability/budget owner.
6. Approve whether the six-week launch is private Founder/Backyrd-only or includes selected design partners.

### Deferred commercial decisions, but architecture preserves them

- plan names/prices and included usage;
- billing provider and tax implementation;
- long-term model-provider mix and customer BYO model keys;
- data retention, regional residency, and enterprise compliance commitments;
- OAuth integration priority list after Customer Zero.

---

## 24. Operating Rules After Approval

1. This document is the shared CTO implementation contract. Material departures require an ADR and Founder/CTO decision.
2. No developer mandates are issued until this blueprint is approved; the mandates will reference these shared contracts rather than redefine them.
3. Founder decides product intent, commercial direction, and material scope. CTO decides architecture, security, contracts, technical quality, and release readiness.
4. The CTO may halt a track or launch for any listed NO-GO condition.
5. Build order follows the core loop. A feature without a clear contribution to Observe → Learn is out of R0.1.

---

## Approval

**Founder:** ____________________ **Date:** __________  
**CTO:** ________________________ **Date:** __________

Once approved, the next artifact is a set of three bounded developer mandates derived from this blueprint, followed by the Week 1 foundation implementation.
