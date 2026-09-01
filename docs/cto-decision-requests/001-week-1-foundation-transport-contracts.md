# CTO Decision Request 001: Week 1 foundation transport contracts

## Status

Approved by CTO Decision 001 on 2026-08-30.

## Approved decision

Approve the minimal, versioned public/API transport contracts for the following existing canonical entities:

1. Tenant creation and response
2. Company creation and response
3. Founder membership bootstrap and membership response
4. Agent provisioning request and response

## Resolved rationale

`@nuknuk/api-contracts` presently provides `tenantScopeSchema`, `organizationNodeSchema`, and `agentCharterSchema`, but no schemas for the four operations above. ADR 0003 makes those Zod schemas the transport source of truth, and the Dev A mandate forbids independently changing shared API shapes or domain vocabulary.

Adding inferred schemas would have created an unreviewed public contract. CTO Decision 001 now authorizes the four explicit schemas. This change still exposes no browser mutation endpoint or full `/api/v1` surface.

## Frozen Week-1 transport inputs

- `CreateTenant`: name and slug only.
- `CreateCompany`: tenant ID, name, slug, timezone, and base currency.
- `CreateMembership`: tenant ID, company ID, user ID, and one initial role. Founder bootstrap is separate from ordinary membership creation.
- `ProvisionAgent`: tenant/company scope, organization node ID, and charter version ID. The server creates the opaque agent ID and application-capability identity.

## Compatibility and security implications

These shapes need idempotency and RFC 9457 error conventions before public `/api/v1` exposure. Bootstrap must be a server-side authenticated flow, not a client-side table write. Approval will let Dev A replace the temporary server persistence seam with a reviewed service/API contract and gives Dev B/C one source of truth.
