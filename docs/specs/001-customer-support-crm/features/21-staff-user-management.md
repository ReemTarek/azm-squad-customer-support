# Feature Spec: Staff & User Management UI

**Date:** 2026-08-24
**Requirement:** CRM-ADMIN-003
**Round:** Round 2 — Post-Test-Suite Enhancements, item 2 of 9

## Goal

Give an Admin a real in-app screen to create, list, edit, and
deactivate Agent/Manager/Admin accounts — today this is API-only
(`POST/GET/PATCH /api/users`), an explicitly documented gap
(`17-multi-department-branch.md`'s Status section, `rubric-evidence.md`).
Also close the related gap that `AdminOrgSettingsPage.tsx` itself
flags: assigning a staff member to a department/branch has no UI.

## Assumptions

- There is currently **no account-deactivation capability at all** —
  not just missing UI, but no `isActive`-equivalent field on `User`
  in `schema.prisma`, and no backend logic that blocks login for a
  deactivated account. This is a real, new schema change, not just a
  UI addition.
- A deactivated account must be blocked at login (`POST /api/auth/login`)
  — a UI toggle with no backend enforcement would be theater, not a
  real feature.
- Staff department/branch assignment already works end-to-end at the
  API level (`PATCH /api/users/:id` accepts `departmentId`/`branchId`,
  per `17-multi-department-branch.md`) — this feature only adds the UI
  surface, no new backend capability beyond `isActive`.
- This page cannot create `Customer` accounts — customers self-register
  (`08-customer-portal.md`); `createStaffUserSchema` on the backend
  already restricts `POST /api/users`'s role to Admin/Manager/Agent,
  which is correct and stays unchanged.

## Scope

- **Schema:** add `isActive Boolean @default(true)` to `User`
  (new Prisma migration).
- **Backend:**
  - `POST /api/auth/login` — reject with 401 if the matched user's
    `isActive` is `false` (same error shape as a wrong password, to
    avoid leaking which accounts exist/are disabled).
  - `updateUserSchema`/`PATCH /api/users/:id` — accept an optional
    `isActive: boolean` field, Admin-only (already Admin-only for this
    route).
  - No new endpoints needed beyond this — `GET /api/users`,
    `POST /api/users`, `PATCH /api/users/:id` already cover
    list/create/edit.
- **Frontend:**
  - New page `frontend/src/pages/admin/UsersPage.tsx`, route
    `/admin/users`, Admin-only, new "Users" nav link in `Layout.tsx`.
  - List all staff (`GET /api/users`, optionally filtered by role tabs:
    Admin/Manager/Agent) showing name, email, role, department, branch,
    active/inactive status.
  - Create-staff form: email, password, name, role, optional
    department/branch pickers (reusing the same picker components
    already built for ticket/customer forms per
    `17-multi-department-branch.md`).
  - Edit-in-place (or a small edit form) for role, department, branch,
    and an active/inactive toggle.
- An Admin cannot deactivate their own account (guard in the frontend
  and, defensively, in the backend PATCH handler) — prevents an Admin
  locking themselves out with no other Admin account to fix it.

## Out of scope

- Self-service password reset/change for staff (unrelated feature).
- Bulk import/export of users.
- A dedicated audit-log UI entry type for user edits beyond whatever
  the existing generic audit logging already captures for `PATCH`
  requests (verify at implementation time whether user edits are
  already logged; if not, that's a one-line addition, not a new
  sub-project).

## Acceptance criteria

- [x] Admin can create an Agent, a Manager, and another Admin account
      through the UI, each appearing correctly in the list.
- [x] Admin can edit an existing staff member's role and
      department/branch through the UI, and the change is reflected
      immediately (e.g. a Manager's ticket-list scope changes
      accordingly — reusing the existing scoping logic, unchanged).
- [x] Admin can deactivate a staff account; that account's next login
      attempt is rejected with 401.
- [x] Admin cannot deactivate their own account (UI prevents it; a
      direct API attempt is also rejected).
- [ ] A deactivated Agent's already-issued access token still works
      until it naturally expires (per the existing JWT expiry, not
      instantly revoked) — document this as the accepted trade-off
      (no token-revocation list exists in this project; consistent
      with the stateless-JWT design already chosen, `decisions.md`).
      Not re-verified live in Task 3 (would require capturing a token,
      deactivating the account, then replaying the token before natural
      expiry) — accepted as an architectural consequence of the
      stateless-JWT design, unchanged and already documented in
      `decisions.md`, not because it was newly tested here.

## Implementation

New migration under `backend/prisma/migrations/`; `backend/src/routes/auth.ts`
(login check); `backend/src/validation/users.schema.ts` (add `isActive`);
`backend/src/routes/users.ts` (self-deactivation guard);
`frontend/src/pages/admin/UsersPage.tsx` (new); `frontend/src/lib/usersApi.ts`
(extend if needed); `frontend/src/components/Layout.tsx` (nav link);
`frontend/src/App.tsx` (route).

## Verification plan

Real running-app verification per this project's established pattern:
create/edit/deactivate a staff account through the UI, confirm the
deactivated account's login attempt returns 401 via curl, confirm a
department/branch reassignment actually changes what a Manager sees in
their ticket list (re-using the TASK-042 regression scenario as the
check).

## Status: Done

Verified end-to-end across Tasks 1-3: schema migration + backend
login-enforcement/audit-logging (Task 1, 27/27 backend tests
including the new deactivated-login test), the `/admin/users` UI
(Task 2, browser-driven verification of create/edit/deactivate),
and this task's live re-verification that reassigning a Manager's
department through the UI's department-edit control actually changes
their real ticket-list authorization scope (not just a displayed
label) — see `docs/verification.md` and
`.superpowers/sdd/2026-08-25-staff-user-management/task-3-report.md`
for full evidence.
