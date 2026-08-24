# Feature Spec: Database Persistence

**Requirement:** CRM-DB-001
**Related tasks:** TASK-001, TASK-002

## Goal
All application data persisted through Prisma against a real
relational database.

## Scope
- Prisma schema covering every P0 entity (User, CustomerProfile,
  Ticket, TicketMessage, TicketStatusHistory, KnowledgeBaseArticle) plus
  cheap-to-add P1 entities (CustomerFeedback, AuditLog).
- Migrations checked into `backend/prisma/migrations`.
- Seed script creating a default Admin account.
- SLA priority thresholds as an in-code constant map, not a DB table
  (data-model.md: "not user-editable in P0").
- **Database engine: SQLite** (`backend/dev.db`), by deliberate final
  decision — see below.

Out of scope: user-editable SLA config, soft deletes, audit triggers.

## Acceptance criteria
- [x] `prisma migrate dev` succeeds and creates all P0 tables.
- [x] Seed script creates `admin@azmcrm.local` and is idempotent (no
      duplicate on re-run).
- [x] A row written through the API is readable back through a
      separate query (real persistence, not just an in-memory mock).

## Implementation
- DB: `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`.
- No API/frontend surface of its own — every other feature depends on
  this layer.

## Why SQLite instead of SQL Server

CRM-DB-001 originally specified SQL Server. The local SQL Server
instance turned out to have TCP/IP disabled at the protocol level
(`sqlcmd` connected fine via Shared Memory; Prisma's driver only
speaks TCP) — fixing it needs an admin-elevated registry change +
service restart. Rather than pause on an OS-level config change, the
user made a deliberate call: **standardize on SQLite going forward**,
not as a stopgap. Prisma's query API is identical across providers, so
this had zero effect on the schema, routes, or business logic — only
`datasource.provider` and `DATABASE_URL` differ from the original plan.
Full account in `docs/debugging-notes.md` and `docs/decisions.md`.

## Verification
See `docs/verification.md` ("DB connectivity" row, PASS).

## Status: Done
