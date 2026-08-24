# Feature Spec: Basic Reporting

**Requirement:** CRM-REPORT-001
**Related task:** TASK-015

## Goal
A Manager/Admin can see a simple operational snapshot: ticket volume
by status/priority, average resolution time, and load per agent.

## Scope
- `GET /reports/summary` (Admin/Manager only): counts by status,
  counts by priority, average resolution time (resolved tickets only),
  ticket count per agent.
- Plain Prisma `groupBy` aggregates — no separate analytics store or
  scheduled rollup job.

Out of scope: charts/graphs, date-range filtering, SLA-breach trend
reporting (P1), export.

## Acceptance criteria
- [x] Numbers match a manual DB count on the same dataset.
- [x] Agent role is blocked from the endpoint (403).

## Implementation
- Backend: `backend/src/routes/reports.ts`.
- Frontend: `frontend/src/pages/ReportsPage.tsx` (simple stat cards),
  nav link gated to Admin/Manager.

## Verification
`docs/verification.md`: "Reporting accuracy" row — PASS, cross-checked
against a manual Prisma `groupBy` script (exact match).

## Status: Done
