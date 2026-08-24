# Feature Spec: SLA Escalation Sweep

**Requirement:** CRM-SLA-ESCALATE-001
**Related task:** TASK-033

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

Give SLA breaches a real consequence (priority escalation), not just a
visible badge — closing the gap `gap-analysis.md` identified: "SLA
state is visible, but nothing acts on it."

## Assumptions

- Consistent with the existing compute-on-read SLA architecture (no
  cron/worker — see `docs/specs/001-customer-support-crm/decisions.md`):
  escalation is an **explicit triggered action**, not an automatic
  background sweep. This is a deliberate architectural consistency
  choice, not an oversight — a real cron-based version would
  contradict the earlier documented decision to avoid background
  jobs for this project's timeframe.
- Escalating means bumping `priority` to `Urgent`; a ticket already at
  `Urgent` is left alone (nothing higher to escalate to) rather than
  re-triggering every sweep.

## Scope

- `POST /tickets/escalate-overdue` (Admin/Manager only): finds
  Open/InProgress tickets that are `breached` (per the existing
  `computeSlaState`) and not already `Urgent`, bumps each to `Urgent`,
  writes an audit-log entry per ticket.
- "Escalate Overdue Tickets" button on the Reports page.

Out of scope: automatic/scheduled execution, reassigning the ticket to
a different (e.g. more senior) agent as part of escalation, customer
notification on escalation.

## Acceptance criteria

- [x] A breached, non-Urgent ticket gets bumped to Urgent when the
      sweep runs.
- [x] A ticket already breached-and-Urgent is left alone (confirmed by
      cross-checking manual per-agent SLA-state queries before/after).
- [x] Each escalation writes an audit-log entry with
      from/to-priority and reason.
- [x] Agent/Customer roles blocked (403).

## Implementation

`backend/src/routes/tickets.ts` (`POST /escalate-overdue`),
`frontend/src/pages/ReportsPage.tsx`.

## Verification

curl: seeded a genuinely breached, non-Urgent ticket, ran the sweep,
confirmed its priority became `Urgent` and an audit entry was written;
confirmed an already-Urgent breached ticket was correctly skipped
(count-based cross-check). Playwright: button runs, shows "Escalated N
ticket(s)."

## Status: Done
