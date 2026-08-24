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

## Process gap: 10 post-P1 items were built before being individually spec'd

**Context:** every P0/P1 requirement, and TASK-037 onward (SLA config,
customer notes, multi-department/branch, AI chatbot), followed strict
spec-first discipline: a spec was written, the user reviewed/approved
it (directly, or via an explicit design-option question), and only
then was code written. The 10 "post-P1 enhancement" items (TASK-027
through TASK-036 — KB search, ticket category, customer interaction
history, aggregate CSAT/agent reports, AI ticket summary, AI-suggested
KB articles, SLA escalation sweep, in-app notifications, and the P2
notification/ERP adapters) did not follow this — they were built
directly from a gap-analysis recommendation list once the user
approved the bucket as a whole ("small high-value fixes", "AI
extensions", etc.), and individual spec documents were written
*after* the code existed.

**Why it happened:** these were framed (by me) as small, low-risk,
pattern-matching extensions of already-verified features (e.g. KB
search mirrors the customer list's existing search; ticket category
mirrors the KB's existing category field) — a judgment call that
heavier upfront spec ceremony wasn't needed for each one individually,
given the user had already approved the bucket. In hindsight this
broke the project's own SDD discipline and is inconsistent with how
every other requirement was handled.

**What changed:** when this was flagged, each of the 10 items got its
own individual spec (`features/14a` through `14h`, plus the pre-
existing `features/13`), explicitly labeled with a process note
stating they were written after implementation and why, rather than
silently back-dating them to look spec-first. Every subsequent feature
(the two big items, multi-department/branch and the AI chatbot, plus
SLA config and customer notes) went back to strict spec-first,
including presenting design *options* to the user before writing the
spec for the two larger ones.

**Trade-off:** the retroactive specs are honest documentation of what
was built and why, and still show clear acceptance criteria and
verification — but they cannot claim the same "requirements review
before implementation" evidence that spec-first work can. See
`docs/rubric-evidence.md` for how this is scored against the
assessment rubric without overstating what happened.

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
