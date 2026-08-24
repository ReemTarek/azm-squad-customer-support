# Feature Spec: Admin-Editable SLA Configuration

**Requirement:** CRM-SLA-CONFIG-001
**Related task:** TASK-037

## Goal

An Admin can change the response/resolution minute thresholds per
priority without a code deploy — replacing the current hardcoded
constant map in `services/sla.ts`.

## Scope

- New `SlaPolicy` model: one row per `Priority` (unique), with
  `responseMinutes` and `resolutionMinutes`. Seeded with today's
  hardcoded values so behavior is unchanged until an Admin edits one.
- `computeSlaDueDates()` reads thresholds from this table instead of
  the in-code map. No change to `computeSlaState()` — breach/at-risk
  derivation logic is unaffected, only where the numbers come from.
- `GET /admin/sla-config` (Admin only): list all 4 rows.
- `PATCH /admin/sla-config/:priority` (Admin only): update one row.
- Frontend: an Admin-only "SLA Settings" page, one row per priority
  with two editable number fields, a save button per row (or one
  save-all button — implementer's call, keep it simple).

Out of scope: per-department/per-branch policies (depends on the
not-yet-approved multi-department discussion item), historical
versioning of policy changes, applying a new threshold retroactively
to tickets already created (due dates are computed once at write
time — this is unchanged, a deliberate consequence of the existing
compute-on-write SLA architecture, not a gap to fix here).

## Acceptance criteria

- [ ] Admin views current thresholds for all 4 priorities.
- [ ] Admin edits a threshold, it persists.
- [ ] A ticket created *after* the edit uses the new threshold.
- [ ] A ticket created *before* the edit keeps its original due dates
      (no retroactive recompute).
- [ ] Non-admin (Agent/Manager/Customer) blocked with 403.
- [ ] Invalid input (negative/zero minutes) rejected with 400.

## Implementation notes

- `backend/prisma/schema.prisma`: add `SlaPolicy`.
- `backend/src/services/sla.ts`: `computeSlaDueDates` becomes async,
  queries `SlaPolicy` by priority (no caching needed — ticket
  creation/priority-change isn't a hot path).
- `backend/src/routes/adminSlaConfig.ts`: new router, mounted at
  `/api/admin/sla-config`.
- `frontend/src/pages/AdminSlaSettingsPage.tsx`, nav link gated to
  Admin only.

## Verification plan

curl: PATCH a threshold → create a ticket at that priority → confirm
`responseDueAt`/`resolutionDueAt` reflect the new minutes (compare to
`createdAt + minutes`). Create-before/edit-after ordering check that
an existing ticket's due dates didn't change. Playwright: edit via
UI, reload, confirm persisted; Agent gets 403 hitting the page/API.

## Status: Not Started
