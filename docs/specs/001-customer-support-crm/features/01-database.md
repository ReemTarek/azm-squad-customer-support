# Feature Spec: Database Persistence

**Requirement:** CRM-DB-001
**Related tasks:** TASK-001, TASK-002

## Goal
All application data persisted through Prisma against SQL Server.

## Scope
- Prisma schema covering every P0 entity (User, CustomerProfile,
  Ticket, TicketMessage, TicketStatusHistory, KnowledgeBaseArticle) plus
  cheap-to-add P1 entities (CustomerFeedback, AuditLog).
- Migrations checked into `backend/prisma/migrations`.
- Seed script creating a default Admin account.
- SLA priority thresholds as an in-code constant map, not a DB table
  (data-model.md: "not user-editable in P0").

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

## Verification
See `docs/verification.md` ("DB connectivity" row) and
`docs/debugging-notes.md` for the SQL Server TCP/IP issue hit along the
way.

## Status: Done, with a known deviation
Running on **SQLite**, not SQL Server, because the local SQL Server
instance has TCP/IP disabled and enabling it needs an admin-elevated
change not made during this session (see `docs/decisions.md`). The
Prisma layer is provider-agnostic for our usage, so switching back is a
one-line `datasource.provider` + `DATABASE_URL` change — **this must
happen before the requirement can be marked fully satisfied**, since
CRM-DB-001 explicitly calls for SQL Server.
