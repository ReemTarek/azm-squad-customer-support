# Feature Spec: Home Dashboard

**Date:** 2026-08-26
**Requirement:** CRM-DASH-002 (extends CRM-DASH-001, which the original
`/tickets` list page already satisfies — see the note below)
**Round:** Round 3 — item 1 of 1, discovered after Round 2 closed out

## Goal

Replace the `/` landing page's bare "Welcome, {name}" placeholder with
a real, role-aware dashboard that surfaces what each role actually
needs to see first: a Customer's own tickets, an Agent's assigned
work prioritized by urgency, and Manager/Admin org-level stats —
reusing existing, already-role-scoped backend endpoints, with **no
new backend surface**.

## Assumptions

- `frontend/src/pages/DashboardShellPage.tsx` (the `/` route) is
  confirmed to currently render only a welcome heading and a subtitle
  — no widgets, no data fetching. This was never a named requirement
  in the original spec; it's an unfilled placeholder.
- `CRM-DASH-001` ("Agent dashboard: tickets assigned to me, filterable
  by status/priority") was already satisfied by design during the
  original build — `implementation-plan.md`'s TASK-011 records that
  the `/tickets` list page doubles as the Agent dashboard, since the
  backend already scopes an Agent's ticket query to their own
  `assignedAgentId`. This spec does not redo that; it adds a genuine
  landing-page summary on top, which CRM-DASH-001 never asked for.
- **No new backend endpoints.** Every widget is built by composing
  data from endpoints that already exist and are already correctly
  role-scoped server-side: `GET /api/tickets` (Customer → own tickets
  only, Agent → assigned tickets only, Manager → department/branch-
  scoped, Admin → unrestricted), `GET /api/notifications/summary`
  (breached/at-risk counts, same role scoping, any authenticated
  role), `GET /api/reports/summary` and `GET /api/reports/trends`
  (Admin/Manager only, department-scoped for Manager), and
  `GET /api/reports/ai-usage` (Admin/Manager only). Confirmed via
  direct reading of `backend/src/routes/tickets.ts`,
  `notifications.ts`, and `reports.ts` before writing this spec.
- `GET /api/tickets` has no server-side sort by `updatedAt` (only
  `createdAt desc`) and the frontend's `listTickets()` wrapper doesn't
  currently pass `assignedAgentId` through. "Top N most relevant
  tickets" widgets sort/slice **client-side** after fetching — ticket
  volumes per user in this app's scale make this fine; no backend sort
  parameter is being added for this.
- Reuses the exact stat-tile card grid pattern already established on
  `ReportsPage.tsx` (`row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3`
  + `col > card h-100 > card-body`) and the existing `SlaBadge`
  component — no new visual language.
- Widgets degrade gracefully with zero data (a Customer/Agent with no
  tickets sees an empty-state message, not an error or a blank gap) —
  same principle as every other Round 2 feature's "nothing configured
  → no regression" requirement, applied here as "no data → no crash,
  no ugly blank state."

## Scope

- Rewrite `frontend/src/pages/DashboardShellPage.tsx` to branch on
  `user.role`:
  - **Customer**: a "My Tickets" card listing up to 5 of the
    customer's own tickets (sorted client-side by `updatedAt` desc),
    each row showing subject/status/`SlaBadge`, linking to the ticket
    detail page; a "New Ticket" button; an empty-state message if the
    customer has zero tickets.
  - **Agent**: a "My Tickets" card listing up to 5 assigned tickets,
    sorted client-side to surface `breached` and `at_risk` SLA states
    first (then by `updatedAt` desc within each group); a small SLA-
    alerts stat tile fed by `GET /api/notifications/summary`
    (`breachedCount`/`atRiskCount`, the same numbers already driving
    the nav badge); a "View all my tickets" link; empty-state if none
    assigned.
  - **Manager**: stat tiles built from `GET /api/reports/summary`
    (tickets by status, avg resolution minutes — already department-
    scoped for a scoped Manager) and `GET /api/reports/trends`'s
    `slaBreachRatePercent`; a "View full report" link to `/reports`.
  - **Admin**: the same tiles as Manager (org-wide, since an Admin's
    report queries are unrestricted) plus one condensed AI-usage tile
    (suggested-reply used rate, chatbot confident rate) from
    `GET /api/reports/ai-usage`; a "View full report" link.
- New `frontend/src/lib/dashboardApi.ts` only if genuinely needed for
  a data-shaping helper beyond what `ticketsApi.ts`/`reportsApi.ts`/
  `notificationsApi.ts` already export — decided at plan time; likely
  unnecessary since every underlying wrapper function already exists.

## Out of scope

- Any new backend endpoint, schema change, or new query parameter
  (e.g. a server-side `updatedAt` sort or an `assignedAgentId=me`
  passthrough) — client-side sorting of the already-fetched, already-
  scoped ticket list is sufficient at this app's scale.
- Customizable/rearrangeable dashboard widgets (a fixed, role-
  determined layout is sufficient for this version).
- Real-time/live-updating widgets beyond whatever polling the reused
  endpoints already have (`notifications-summary` already polls every
  30s via its existing `refetchInterval` in `Layout.tsx`; this
  dashboard's own queries use React Query's normal defaults, no new
  polling added).
- A dashboard variant for a role with department/branch set to null
  behaving differently from one with it set — this already falls out
  correctly from the reused endpoints' own existing scoping logic,
  nothing new to build.

## Acceptance criteria

- [x] A Customer landing on `/` sees up to 5 of their own tickets with
      SLA badges and a working "New Ticket" link; a Customer with zero
      tickets sees a clear empty state, not an error or blank page.
      **VERIFIED:** Live browser testing confirmed Customer role renders ticket widget with SLA badges; empty state displayed for Customer with zero tickets (no error, no blank gap).
- [x] An Agent landing on `/` sees up to 5 of their assigned tickets,
      with breached/at-risk ones surfaced first, plus an SLA-alerts
      count matching the same numbers shown in the nav badge.
      **VERIFIED:** Live browser testing confirmed Agent dashboard sorts tickets by urgency (older breached ticket surfaced ahead of newer on-track ticket), SLA-alerts stat tile displays correct counts matching nav badge.
- [x] A Manager landing on `/` sees ticket-status/avg-resolution/SLA-
      breach-rate stats scoped to their own department (verified
      against a direct comparison to what `/reports` shows the same
      Manager, which must match exactly since both read the same
      endpoints).
      **VERIFIED (re-verified during the fix-wave-1 review pass, replacing
      prior vacuous evidence):** The original evidence used a test Manager
      with no `departmentId` set, whose numbers were digit-identical to
      Admin's org-wide numbers by `getOrgScopeWhere`'s own documented
      fallback — it never actually exercised department scoping. Re-verified
      with a Manager genuinely assigned to a department ("DeptA") containing
      4 tickets (1 InProgress, 2 Open, 1 Resolved), while 1 additional ticket
      existed in a sibling department ("DeptB") and the org overall held 39
      tickets across all departments/pre-existing seed data. Live browser
      testing (Playwright) confirmed: Manager dashboard showed byStatus
      InProgress 1 / Open 2 / Resolved 1 (4 total), avg resolution 14400 min,
      SLA breach rate 100% — matching a direct `GET /api/reports/summary`
      call for the same Manager exactly, and genuinely narrower than the
      Admin's org-wide dashboard shown in the same session (Closed 2 /
      InProgress 5 / Open 25 / Resolved 12 = 39 total, avg resolution 2064
      min, SLA breach rate 14%) — proving real department-scoped filtering
      this time, not an accidentally-unscoped Manager.
- [x] An Admin landing on `/` sees the same stats org-wide plus the
      AI-usage snapshot.
      **VERIFIED:** Live browser testing confirmed Admin dashboard displays org-wide stat tiles matching `/reports` numbers (byStatus, avg resolution, SLA breach rate) plus AI-usage tile matching `/reports` AI-trust numbers (100%), all verified in same session.
- [x] No new backend endpoint or schema change was introduced — every
      widget's data comes from an endpoint that already existed before
      this feature, confirmed by diffing `backend/src/routes/` against
      this feature's commits.
      **VERIFIED:** `git diff --stat 51034d8..HEAD -- backend/` returns empty output, confirming zero backend files modified across entire feature (Task 1 base commit through HEAD).

## Implementation

`frontend/src/pages/DashboardShellPage.tsx` (full rewrite); possibly
`frontend/src/lib/dashboardApi.ts` (only if a genuine gap is found at
plan time); no backend files.

## Verification plan

Log in as each of the four roles (seed/create one Agent, one Manager,
reuse the seeded Admin, reuse an existing Customer) with realistic
data (a few tickets in varying SLA states) and confirm each role's
dashboard renders the correct, correctly-scoped widgets; confirm a
Manager's dashboard numbers match `/reports`'s numbers exactly for the
same login; confirm a fresh Customer/Agent with zero tickets sees a
clean empty state.

## Status: Done
