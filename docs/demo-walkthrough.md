# Demo / Technical Interview Walkthrough

## Guaranteed demo path

Admin login → create agent → create customer → customer creates ticket
→ admin assigns ticket to agent → agent login → agent views assigned
ticket → agent uses Gemini suggested reply → agent responds → status
updated (history recorded) → SLA state visible throughout → agent
resolves ticket → customer views updated ticket → (customer feedback —
P1, not built) → manager views resulting dashboard/report.

Verified end-to-end via an automated Playwright run covering all 15
steps above with zero console errors (see
`docs/specs/001-customer-support-crm/implementation-plan.md`, TASK-020).

## Architecture overview

React SPA (Vite) → Express REST API (routes → RBAC middleware →
services → Prisma) → SQL Server (currently SQLite, see below). Gemini
is called server-side only; the frontend never sees the API key. Full
diagram in `docs/specs/001-customer-support-crm/architecture.md`.

## Major engineering decisions

- **Express + Prisma over NestJS/.NET** — least ceremony for a solo
  3-day build; Prisma has mature SQL Server support.
- **SLA computed-on-read, no scheduled job** — due timestamps are
  calculated at write time; state (on_track/at_risk/breached) is
  derived by comparing to "now" whenever a ticket is read. No
  cron/worker process to deploy or monitor.
- **Every Customer is a `User` row** (role=Customer) with a 1:1
  `CustomerProfile`, not a separate identity system — one login flow,
  one JWT shape, for every role.
- **Manual assignment only in P0** — automatic/load-balanced
  assignment is P1, deliberately deferred so the ticket↔agent
  relationship and dashboard scoping could be proven solid first.
- **Stateless JWT refresh tokens** — no server-side revocation list;
  simpler for the timeframe, at the cost of not being able to revoke a
  refresh token early (acceptable trade-off, noted in decisions.md).

Full record: `docs/specs/001-customer-support-crm/decisions.md`
(spec-time) and `docs/decisions.md` (implementation-time).

## Database approach

Prisma ORM, schema in
`docs/specs/001-customer-support-crm/data-model.md`, migrations in
`backend/prisma/migrations`. **Currently running on SQLite**, not SQL
Server — the local SQL Server instance has TCP/IP disabled at the
protocol level (see "difficult technical problem" below), and
switching back is a one-line `datasource.provider` + `DATABASE_URL`
change since Prisma's query API doesn't change between providers. This
is the one requirement (CRM-DB-001) not fully satisfied as specified.

## Backend request flow (example: posting a ticket reply)

`POST /tickets/:id/messages` → `requireAuth` (verifies JWT, attaches
`req.user`) → `requireRole(Admin, Manager, Agent, Customer)` →
`assertTicketAccess` (404 if the ticket doesn't exist, 403 if a
Customer doesn't own it) → `createMessageSchema.parse(req.body)` (zod;
throws → caught by the central error middleware → 400 with field
details) → `isInternalNote` is force-set to `false` when the caller is
a Customer, regardless of what they sent → `prisma.ticketMessage.create`
→ `201` with the created message.

## Frontend state/data flow

React Query owns all server state (no separate global store). Each
page declares its queries/mutations inline; mutations call
`queryClient.invalidateQueries` on success so the UI reflects the new
server truth rather than manually patching local state. Auth state
(current user, tokens) lives in a small `AuthContext` backed by
`localStorage`; `apiClient`'s response interceptor transparently
refreshes an expired access token once and retries the original
request before giving up.

## Authentication flow

Register/Login issue a 15-minute access token + 7-day refresh token
(both JWTs, `HS256`). `RequireAuth` (frontend) redirects unauthenticated
users to `/login`. On a 401 from any API call (except login/register
themselves), the client calls `/auth/refresh` once; if that also fails,
tokens are cleared and the user is redirected to log in again.

## Authorization strategy

Two layers, applied consistently: `requireRole([...])` for
role-gating, plus an explicit ownership check in the route/service code
wherever a role alone isn't sufficient — e.g. a Customer can hit
`GET /tickets/:id` (role-allowed) but still gets 403 if they don't own
that specific ticket; an Agent can hit `PATCH /tickets/:id` but still
gets 403 if they aren't the *assigned* agent. This pattern is repeated
across customers, tickets, and KB routes rather than trusting role
checks alone.

## AI integration

`services/gemini.ts` builds a prompt from the ticket's subject,
priority, and full message thread (internal notes included as
agent-only context, since the output is an editable draft the agent
reviews before sending — never sent automatically, never shown to the
customer). Real key, real API. Any failure — missing key, model error,
timeout — is caught and surfaced as a 503 `AI_UNAVAILABLE`, logged
server-side, never a crash.

## A difficult technical problem solved

SQL Server refused every connection from Prisma (`P1001`) despite the
service running and `sqlcmd` connecting fine. Root cause: `sqlcmd` was
using Shared Memory/Named Pipes, while Prisma's driver only speaks TCP
— and TCP/IP was disabled in the instance's network configuration
(`SuperSocketNetLib\Tcp\Enabled = 0`), unrelated to the Windows
Authentication setup that was the original suspect. Fixing it requires
an admin-elevated registry change + service restart, which was outside
what the assistant's tooling could do and the user chose not to do
mid-session — so SQLite was substituted as a like-for-like stand-in
via Prisma (same query API, same models), with the real root cause and
fix path documented for later. Full account in
`docs/debugging-notes.md`.

## Trade-offs made because of the 3-day deadline

- SQL Server deferred to SQLite (above) rather than spending session
  time on an OS-level network config change.
- Automatic assignment, quick-reply templates, task/reminders, audit
  log UI, and customer satisfaction ratings (all P1) were not started —
  every P0 requirement was fully built and verified first, per the
  brief's own priority ordering.
- i18n covers the core screens (nav, auth, dashboard, tickets) rather
  than every string in the app — enough to prove the mechanism and
  RTL layout work correctly.
- WhatsApp/SMS/ERP integrations (P2) were not touched at all — no
  credentials, and explicitly flagged as "do not implement" in the
  brief unless P0+P1 are done with time remaining.

## What would be improved for production

- Switch to SQL Server (the one open P0 item) and add integration
  tests that run in CI against a real instance.
- Server-side refresh-token revocation (currently stateless JWTs).
- Automatic ticket assignment (least-loaded agent), SLA breach
  notifications (the compute-on-read model has no push mechanism),
  and a real audit-log UI (schema exists, no UI yet).
- OAuth/SSO, rate limiting, and structured logging/observability.
- Full i18n coverage and a locale-persistence endpoint (User.locale
  exists in the schema but isn't wired to a save action yet).
