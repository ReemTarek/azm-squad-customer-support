# Demo / Technical Interview Walkthrough

Living document — filled in as implementation proceeds. Final pass
happens after TASK-020 (demo dry run).

## Guaranteed demo path

Admin login → create agent → create customer → customer creates ticket
→ admin assigns ticket to agent → agent login → agent views assigned
ticket → agent uses Gemini suggested reply → agent responds → status
updated (history recorded) → SLA state visible throughout → agent
resolves ticket → customer views updated ticket → customer submits
feedback (P1, if built) → manager views report.

## Architecture overview

See `docs/specs/001-customer-support-crm/architecture.md` for the full
diagram. Summary: React SPA → Express REST API (routes → middleware →
services → Prisma) → SQL Server. Gemini called server-side only.

## Major engineering decisions

See `docs/specs/001-customer-support-crm/decisions.md` (spec-time) and
`docs/decisions.md` (implementation-time) for the full record. Headline
ones: Express+Prisma over Nest/.NET, SLA computed-on-read (no worker
process), manual-only assignment in P0, unified User table for every
role including Customer.

## Database approach

Prisma ORM against SQL Server, migrations checked into
`backend/prisma/migrations`. Schema in `data-model.md`.

## Backend request flow

_(fill in with a concrete example once built, e.g. POST /tickets/:id/messages request path through middleware/service/Prisma)_

## Frontend state/data flow

_(fill in once frontend is built — React Query cache strategy, auth token refresh flow)_

## Authentication flow

_(fill in: JWT issue/verify/refresh sequence, where tokens are stored client-side)_

## Authorization strategy

_(fill in: requireRole + ownership-check pattern, with a concrete example)_

## AI integration

_(fill in: Gemini suggest-reply request/response shape, failure handling)_

## One difficult technical problem solved

_(fill in after TASK-001 — likely candidate: SQL Server Windows Auth
connectivity via Prisma)_

## Trade-offs made because of the 3-day deadline

_(fill in as P1/P2 items are deliberately deferred)_

## What would be improved for production

_(fill in at the end — likely candidates: automatic assignment,
scheduled SLA breach notifications, real WhatsApp/SMS/ERP adapters,
OAuth/SSO, audit log UI, CI/CD)_
