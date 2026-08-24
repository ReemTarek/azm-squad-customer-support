# Spec-time Decisions

Decisions made during brainstorming/design, before implementation
started. Ongoing implementation-time decisions are logged in
`docs/decisions.md` at the project root.

## Backend stack: Express + TypeScript + Prisma (not NestJS, not .NET)
**Context:** need a backend fast to scaffold in a 3-day window, with
good SQL Server support and clear RBAC middleware.
**Options considered:** .NET/EF Core (best native SQL Server support,
more enterprise-typical, but new project ceremony/boilerplate is
heavier); NestJS (more structure, more upfront scaffolding).
**Chosen:** Express + TypeScript + Prisma.
**Why:** least ceremony for a solo 3-day build; Prisma has solid SQL
Server support; user preference.
**Trade-off:** less enforced structure than Nest/.NET — mitigated by
keeping a consistent routes/services/middleware layering by convention.

## SLA computed-on-read, not a scheduled job
**Context:** need "one meaningful SLA workflow" without building infra
automation (explicitly a P2 anti-pattern).
**Options considered:** cron/worker process scanning tickets
periodically and writing a `breached` flag; compute-on-read from
stored due timestamps.
**Chosen:** compute-on-read.
**Why:** no background process to deploy/monitor, still demonstrates
real SLA logic (due-timestamp calc + state derivation), simpler to
verify (no timing race with a worker).
**Trade-off:** no push notification the moment SLA breaches — acceptable
for P0; could add a scheduled sweep in P1 if time allows.

## Manual assignment for P0, automatic assignment deferred to P1
**Context:** brief lists "assignment" as P0 and "automatic assignment"
as P1.
**Chosen:** P0 ships manual assign-to-agent only.
**Why:** automatic assignment strategy (load balancing, skills-based,
etc.) is a design question on its own; P0's job is proving the
ticket→agent relationship and dashboard scoping work end-to-end.

## Windows Authentication for SQL Server — flagged as a verify-first risk
**Context:** user has a local SQL Server with Windows Auth (integrated
security), no SQL-auth login set up.
**Risk:** Prisma's SQL Server driver support for integrated
security/SSPI has been inconsistent across versions; unverified at
design time.
**Decision:** TASK-001 is a dedicated spike to confirm this works
before any other backend work depends on it. Fallback: create a
SQL-auth login (`sa` or app-specific) if integrated security doesn't
work with the installed Prisma version.

## Every Customer is a User row (role=Customer), not a separate table
**Context:** need customers to log in and see only their own tickets.
**Chosen:** single `User` table with a `role` enum; `CustomerProfile`
holds customer-only fields (phone/company) 1:1.
**Why:** unifies auth (one login flow, one JWT shape) instead of two
parallel identity systems; matches how the demo path treats customer
login same as staff login.

## Gemini: real API key, server-side only
**Context:** user supplied a live Gemini API key.
**Chosen:** key lives only in `backend/.env` (git-ignored), read via
`process.env.GEMINI_API_KEY`; never sent to or stored in the frontend.
**Why:** standard secret-handling practice; also matches the P0
requirement to gracefully handle "Gemini disabled" if the key is
absent.
