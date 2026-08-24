# Feature Spec: Ticket Management (create, status, assignment, messaging)

**Requirement:** CRM-TICKET-001, CRM-STATUS-001, CRM-ASSIGN-001, CRM-COMM-001
**Related tasks:** TASK-006, TASK-007, TASK-008, TASK-009

## Goal
The core support workflow: a Customer (or staff on their behalf)
raises a ticket, it gets assigned to an Agent, status moves through a
lifecycle with a full audit trail, and the two sides communicate on a
thread that keeps agent-only notes private.

## Scope
- Create (Customer for self, or Admin/Agent on behalf of a customer).
- List/detail with role-based scoping: Customer → own only, Agent →
  assigned-to-self only (server-enforced regardless of query params),
  Admin/Manager → all.
- Status transitions (Open → InProgress → Resolved → Closed), each
  change recorded in `TicketStatusHistory`.
- Manual assignment to an Agent (Admin/Manager only; validates the
  target user is actually role=Agent).
- Threaded messages with an `isInternalNote` flag; Customer requests
  never receive internal-note rows, and the Customer client can't set
  the flag even if it tried (forced false server-side).
- Only the *assigned* Agent (or Admin/Manager) can update a ticket —
  an unassigned Agent gets 403.

Out of scope: automatic assignment (P1), multi-agent collaboration,
ticket merging/splitting.

## Acceptance criteria
- [x] Ticket created via UI persists and appears in the right scoped
      lists.
- [x] Status change → history entry → visible on reload.
- [x] Assignment → ticket appears in that Agent's (scoped) list.
- [x] Internal note invisible to the owning Customer, both via API and
      UI.
- [x] Cross-customer ticket access → 403.
- [x] Unassigned Agent / Customer attempting to PATCH a ticket → 403.

## Implementation
- Backend: `backend/src/routes/tickets.ts`,
  `backend/src/validation/tickets.schema.ts`.
- Frontend: `frontend/src/pages/tickets/` (list — doubles as the Agent
  dashboard since scoping is server-side — form, detail with status
  control / assign dropdown / message thread / history timeline).

## Verification
`docs/verification.md`: Ticket creation, Cross-customer record access,
Internal note isolation, Status history, Manual assignment, Unassigned
agent blocked, Customer cannot manage ticket — all PASS.

## Status: Done
