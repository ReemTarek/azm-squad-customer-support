# Feature Spec: SLA Workflow

**Requirement:** CRM-SLA-001
**Related task:** TASK-010

## Goal
One meaningful, real SLA mechanism: every ticket has a computed
resolution deadline based on priority, and its current state
(on_track / at_risk / breached) is visible wherever the ticket appears.

## Scope
- Response/resolution due timestamps computed at creation and on
  priority change (`backend/src/services/sla.ts`).
- State derived at *read* time by comparing now() (or `resolvedAt`) to
  the due timestamp — **no scheduled job/worker**. This was a
  deliberate choice to avoid infra automation for a P0 feature (see
  `docs/specs/001-customer-support-crm/decisions.md`).
- At-risk threshold: within the last 20% of the resolution window.
- SLA badge shown on both the ticket list and detail views.

Out of scope: push notifications on breach, escalation automation
(P1), user-editable SLA policy.

## Acceptance criteria
- [x] Priority determines the due timestamps at creation.
- [x] A fresh ticket reports `on_track`.
- [x] A ticket with a past-due `resolutionDueAt` reports `breached`.
- [x] SLA badge renders with distinct styling per state.

## Implementation
- Backend: `backend/src/services/sla.ts` (`computeSlaDueDates`,
  `computeSlaState`), applied in `backend/src/routes/tickets.ts`.
- Frontend: `frontend/src/components/SlaBadge.tsx`.

## Verification
`docs/verification.md`: "SLA breach" row — PASS, verified by directly
creating a ticket with a `resolutionDueAt` 1 hour in the past and
confirming the API reports `breached`.

## Status: Done
