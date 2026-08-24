# Feature Spec: Multi-Department / Multi-Branch (Full RBAC)

**Status: approved 2026-08-24 — full RBAC-scoped version (not the
lightweight tag-only alternative).**
**Requirement:** CRM-ORG-001
**Related tasks:** TASK-039 through TASK-043

## Goal

Support multiple departments and branches as real access-control
boundaries: an Agent/Manager sees only their own department/branch's
tickets and customers by default; Admin sees everything.

## Scope

- `Department` and `Branch` models (name, plus whichever fields are
  actually needed — kept minimal: `id`, `name`).
- `User.departmentId` / `User.branchId` (nullable — existing users
  keep working unassigned until set).
- `Ticket.departmentId` / `Ticket.branchId` (nullable, inherited from
  the assigned agent or customer at creation time if not explicit —
  exact inheritance rule decided during implementation).
- RBAC scoping layered onto the *existing* scoping in `tickets.ts` and
  `customers.ts`: Agent/Manager queries additionally filtered to their
  own department/branch; Admin unrestricted.
- Admin-only CRUD for departments/branches.
- Department/branch picker on ticket/customer/user forms; filter on
  list views; a breakdown dimension on the Reports page.

Out of scope: nested/hierarchical departments, per-department SLA
policies (that's a separate ask, not raised), department-specific
branding.

## Why this needs its own careful rollout

This modifies the most security-sensitive code in the app (ticket/
customer visibility scoping) — TASK-043 (regression re-verification)
is not optional polish, it's how we know the P0 security boundaries
documented in `docs/verification.md` still hold after this change.

## Task breakdown

### TASK-039 — Schema
**Database:** `Department`, `Branch` models; nullable
`departmentId`/`branchId` on `User` and `Ticket`; migration.
**Verification:** migration applies cleanly; existing rows have
null department/branch and continue to load normally.

### TASK-040 — Backend RBAC scoping + admin CRUD
**Backend:** `GET/POST/PATCH /admin/departments`, `GET/POST/PATCH
/admin/branches` (Admin only). Extend `tickets.ts` and `customers.ts`
list/detail queries: Agent/Manager scoped to their own department/
branch in addition to existing scoping rules; Admin unrestricted.
**Verification:** curl — Agent in Department A cannot see a ticket
scoped to Department B (403 or absent from list, matching the existing
pattern); Admin sees both.

### TASK-041 — Frontend
**Frontend:** department/branch fields on ticket/customer/user create
forms; filter dropdowns on Tickets/Customers list pages; Admin
department/branch management page.
**Verification:** Playwright — create a department, assign a ticket to
it, confirm the filter shows/hides it correctly per role.

### TASK-042 — Reports breakdown
**Backend/Frontend:** add a department/branch grouping option to
`/reports/summary` or `/reports/trends`; a selector on the Reports
page.
**Verification:** cross-check against a manual DB query, same pattern
as every other report number in this project.

### TASK-043 — Regression re-verification (required, not optional)
Re-run the full P0 security/edge-case suite from `docs/verification.md`
(cross-customer access, cross-agent access, RBAC 403s, the full
guaranteed demo path) against a dataset that now has multiple
departments/branches, to confirm nothing that was previously verified
silently broke.
**Verification:** every row in the original P0 security section of
`docs/verification.md` re-checked and still PASS.

## Status: Not Started
