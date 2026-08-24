# Engineering Decisions Log

Ongoing decisions made during implementation (as opposed to the
spec-time decisions captured in
`docs/specs/001-customer-support-crm/decisions.md`, which covers stack
choice, SLA strategy, assignment scope, auth model, and Gemini
handling from the design phase).

This file is appended to as meaningful implementation-time decisions
come up (e.g. how a tricky migration was handled, a library swap, an
auth edge case). Entries follow: Context / Options considered / Chosen
approach / Why / Trade-offs.

## SQLite as the permanent database, replacing the originally-planned SQL Server

**Context:** CRM-DB-001 (P0) originally specified SQL Server
persistence. The local SQL Server instance has TCP/IP disabled at the
protocol level (see `docs/debugging-notes.md`); enabling it needs an
admin-elevated registry change + service restart, which the assistant's
tooling can't perform.

**Options considered:** (1) user runs the elevated fix themselves, (2)
a Dockerized SQL Server instance, (3) standardize on SQLite instead.

**Chosen:** SQLite (`file:./dev.db`), Prisma `datasource` provider
`sqlite`. **This is a final decision, not a temporary stand-in** — the
user explicitly chose to drop the SQL Server requirement and keep
SQLite going forward (2026-08-24).

**Why:** unblocks all backend work without touching the user's system
config or requiring Docker Desktop; Prisma's query API is identical
across providers, so no schema/route/business-logic changes were
needed either way.

**Trade-off:** CRM-DB-001 as originally worded said SQL Server
specifically — this is a deliberate, recorded deviation from that
wording, not an oversight. If SQL Server is ever required again, it's a
one-line `datasource.provider` + `DATABASE_URL` change (see
`docs/specs/001-customer-support-crm/features/01-database.md`).

## Pinned Prisma and TypeScript to their mature major versions

**Context:** `npm install` resolved `prisma`/`@prisma/client` to v7 and
`typescript` to v7 by default (both very recent major releases — Prisma
7 moved to a driver-adapter architecture with no mature SQL Server
adapter yet found; TypeScript 7 is the new Go-based rewrite).

**Chosen:** pinned to `prisma@6` / `@prisma/client@6` (6.19.3) and
`typescript@5` (5.9.3), with `@types/node@22` to match the installed
Node.js runtime (v22).

**Why:** both v7s are new enough that ecosystem compatibility (SQL
Server support in Prisma's case, tooling/type-decl compatibility in
TypeScript's case) is unproven; the 3-day deadline doesn't afford time
to debug bleeding-edge tooling issues. The 6.x/5.x lines are the
established, widely-compatible choice.

**Trade-off:** missing whatever new features shipped in the v7 lines;
not a concern for this project's scope.
