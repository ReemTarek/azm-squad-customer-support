# Discussion Spec: Multi-Department / Multi-Branch

**Status: not approved — this document exists to support a scoping
decision, not as a commitment to build.**

## What was asked

The full feature catalog listed "Multi-department" and "Multi-branch"
under Platform. Neither was in the original P0/P1 plan.

## Draft scope if approved

- `Department` and/or `Branch` models (name, plus whichever of the two
  — or both — is actually wanted).
- `User.departmentId` / `User.branchId` (nullable, so existing users
  keep working).
- `Ticket.departmentId` / `Ticket.branchId` (nullable for the same
  reason, or backfilled to a default on migration).
- RBAC scoping extended: an Agent/Manager's ticket queries filtered to
  their own department/branch by default (mirrors the existing
  Agent → "own assigned tickets only" pattern in `tickets.ts`).
- Every list/filter UI (tickets, customers, reports, audit log) gains
  a department/branch picker.
- Reports need a department/branch breakdown dimension.

## Why this is a bigger lift than it looks

It touches nearly every entity and every existing query, not just one
new screen:
- `tickets.ts` GET/POST scoping logic (already the most complex RBAC
  code in the app) gains a second scoping dimension.
- Migrating existing data needs a decision: assign everything to one
  default department, or require it to be set going forward.
- Every place that currently trusts "an Agent sees their own tickets"
  needs re-verification once department scoping layers on top — real
  regression risk to already-verified P0 security boundaries.

## Options

1. **Full scoping** (as drafted above) — real multi-tenancy-lite,
   touches the whole app, meaningful QA effort to re-verify existing
   RBAC guarantees still hold.
2. **Lightweight tag only** — an optional `department` string field on
   `User`/`Ticket` (like the existing `category` field), a filter
   dropdown on lists/reports, **no RBAC scoping change**. Small,
   low-risk, but doesn't actually restrict who sees what — it's a
   label, not an access boundary.
3. **Skip** — not in original scope, revisit only if there's a
   concrete need.

## Recommendation

If wanted at all, start with option 2. Option 1 is a legitimate
feature but is architecturally a different-sized project than
anything else built so far, and risks regressing verified P0 security
guarantees for a feature that was never in the original spec.
