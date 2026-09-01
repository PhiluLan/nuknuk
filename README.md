# nuknuk

The operating system for AI-native companies. This repository is the modular-monolith foundation for the Founding Release (R0.1).

## Architecture in one sentence

**Intelligence proposes; Control authorizes; Execution performs.** Every material transition is tenant-scoped, auditable, and designed for deterministic enforcement.

## Workspace

- `apps/web` — product command center and API v1 boundary
- `apps/worker` — durable job consumers and schedules
- `packages/domain` — framework-free domain invariants and state machines
- `packages/db` — database boundary, migrations, RLS test home
- `packages/api-contracts` — shared Zod/API schemas
- `packages/runtime` — provider abstraction and run lifecycle
- `packages/integrations` — adapter contracts and implementations
- `packages/ui` — shared UI primitives
- `packages/config` — shared tooling configuration

The canonical architecture and scope are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Before work begins, read [CONTRIBUTING.md](CONTRIBUTING.md) and the relevant developer mandate in `docs/dev-mandates/`.

## Local setup

1. Install Node 22 and enable Corepack; the repository pins pnpm 10.17.1.
2. Copy `.env.example` to the app-specific local environment file only when a local service needs it.
3. Run `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Never place Production credentials in a local `.env`, source control, browser code, logs, prompts, job payloads, or test fixtures.
