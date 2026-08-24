# Feature Spec: In-App Notification Badge

**Requirement:** CRM-NOTIFY-001
**Related task:** TASK-034

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

Give staff a passive, always-visible signal that something needs
attention, instead of requiring a manual visit to the Reports page or
ticket list to notice a breach — `gap-analysis.md`: "no in-app or
external notification system at all — SLA state is pull, not push."

## Assumptions

- A polling badge (refetch every 30s) is sufficient — no
  websocket/real-time push infrastructure, consistent with this
  project's general avoidance of that complexity class (see the
  AI-chatbot spec's identical reasoning for the same trade-off).
- Counts are role-scoped using the exact same visibility rules as the
  ticket list itself (Agent → own assigned; Admin/Manager → all;
  Customer → own) — no new access-control surface, just a read of
  data the viewer could already see.

## Scope

- `GET /notifications/summary`: `breachedCount` + `atRiskCount`,
  scoped per the caller's role.
- A count badge on the "Tickets" nav link, refetching every 30s via
  React Query's `refetchInterval`.

Out of scope: push notifications (browser/email/SMS on breach — that's
a different feature, notification *channels*, not this in-app badge),
per-ticket dismissal/read-state.

## Acceptance criteria

- [x] Badge count matches the sum of breached+at-risk tickets visible
      to that role.
- [x] Customer sees a count scoped to their own tickets only.
- [x] No badge shown when the count is zero.

## Implementation

`backend/src/routes/notifications.ts`,
`frontend/src/components/Layout.tsx`.

## Verification

Playwright: logged in as Admin with known breached/at-risk tickets in
the dataset, confirmed the badge number matched.

## Status: Done
