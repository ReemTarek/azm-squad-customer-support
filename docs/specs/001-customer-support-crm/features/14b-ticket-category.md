# Feature Spec: Ticket Category Field

**Requirement:** CRM-TICKET-003
**Related task:** TASK-028

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

Tickets get a category field, matching what KB articles already had —
`gap-analysis.md` flagged that tickets had priority but no category,
an asymmetry with the KB model.

## Assumptions

- Free-text category (mirroring KB's `category` field), not a fixed
  enum — categories will likely evolve without a migration.
- Default `"General"` when not specified, so existing/legacy ticket
  creation flows (API callers that don't send a category) keep
  working unchanged.

## Scope

- `Ticket.category` (`String`, default `"General"`).
- Settable on create/update, filterable on list.
- Shown on ticket list, detail, and the creation form (with a
  `<datalist>` of common suggestions — still free-text, not a
  constrained picker).

Out of scope: category management UI (add/rename/merge categories),
category-based routing/assignment rules.

## Acceptance criteria

- [x] Creating a ticket without a category defaults to "General".
- [x] Creating with an explicit category persists it.
- [x] Filtering the ticket list by category returns only matches.

## Implementation

`backend/prisma/schema.prisma` (`Ticket.category`),
`backend/src/routes/tickets.ts`,
`backend/src/validation/tickets.schema.ts`,
`frontend/src/pages/tickets/{TicketFormPage,TicketsListPage,TicketDetailPage}.tsx`.

## Verification

curl: create with/without category, confirm default and explicit
values persist; filter by category returns the right subset.
Playwright: create a ticket with category "Technical", confirm it
shows on the detail page and the list filter finds it.

## Status: Done
