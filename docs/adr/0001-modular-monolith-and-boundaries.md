# ADR 0001: Modular monolith and package boundaries

## Status

Accepted

## Decision

R0.1 is a TypeScript modular monolith using pnpm workspaces and Turborepo. The web/API boundary and durable worker are separate applications. Domain logic is framework- and I/O-free.

## Consequences

We move quickly without distributed-service overhead while retaining extraction seams. Cross-package imports must respect the ownership described in `docs/ARCHITECTURE.md`.
