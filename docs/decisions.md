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

## Temporary SQLite substitute for SQL Server (TASK-001)

**Context:** CRM-DB-001 (P0) requires SQL Server persistence. Local SQL
Server has TCP/IP disabled (see `docs/debugging-notes.md`); enabling it
needs an admin-elevated change the assistant's tooling can't perform,
and the user chose not to do it during this session.

**Options considered:** (1) user runs the elevated fix themselves, (2)
Dockerized SQL Server instance, (3) SQLite as a stand-in for now.

**Chosen:** SQLite (`file:./dev.db`), Prisma `datasource` provider
`sqlite` instead of `sqlserver`.

**Why:** unblocks all P0 backend work immediately without touching the
user's system config or requiring Docker Desktop.

**Trade-off / risk:** this does **not** satisfy CRM-DB-001 as written —
it's a stated P0 requirement that "All persistence in SQL Server via
Prisma." SQLite and SQL Server both go through Prisma so the ORM layer
and query code are unaffected, but the datasource itself needs to
switch back before this can be called done. **Action before
submission:** either enable TCP/IP (2 commands, see prior chat) and
change `datasource.provider` back to `sqlserver` + restore the real
`DATABASE_URL`, or move to a Dockerized SQL Server. Tracked in
`docs/verification.md` (DB connectivity row) and
`docs/specs/001-customer-support-crm/acceptance-checklist.md` — do not
check those off against SQLite.

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
