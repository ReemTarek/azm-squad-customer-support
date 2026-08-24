# Feature Spec: Backend Integration Test Suite

**Requirement:** CRM-TEST-001
**Related task:** TASK-048

## Goal

A committed, runnable (`npm test`) test suite that reproduces the
security- and correctness-critical checks currently only recorded as
manual curl/Playwright runs in `docs/verification.md` — so a grader
(or a future change) can verify the app's behavior without re-running
ad-hoc scripts by hand.

## Assumptions

- Integration tests (real Express app + real Prisma against a real,
  isolated SQLite database), not mocked-everything unit tests — this
  project's own `docs/decisions.md` already rejected mocking the
  database once before ("integration tests must hit a real database"
  is the established preference here), and RBAC/ownership bugs (like
  the department-scoping leak found in TASK-042) are exactly the kind
  of thing a mocked DB would hide.
- A **separate test database file** (`test.db`, own `DATABASE_URL`),
  reset before the suite runs — never the dev database with its
  hand-curated demo data.
- Coverage target is the security/correctness boundaries already
  identified as important in `docs/verification.md` — not exhaustive
  coverage of every trivial CRUD path (per this project's own
  productivity guidance against excessive testing of trivial code).
- `src/index.ts` currently builds the Express app *and* calls
  `app.listen()` in the same module — untestable without binding a
  real port. Splitting `app` (importable, no listen) from the
  `listen()` call itself is an in-scope, minimal refactor (separation
  of concerns the tests need, not a redesign).

## Scope

- `backend/src/app.ts`: exports the configured Express `app` (routes +
  middleware), no `listen()`.
- `backend/src/index.ts`: imports `app`, calls `app.listen()` — the
  only thing left in this file.
- Vitest + Supertest, a `.env.test` pointing at `test.db`, a setup
  hook that runs migrations fresh before the suite.
- Test files, one per resource, covering:
  - **Auth:** register, login (success + wrong password), refresh
    (success + invalid token), missing/malformed JWT on a protected
    route.
  - **RBAC:** Customer blocked from an Admin-only route; Agent blocked
    from an unassigned ticket's PATCH.
  - **Customers:** create, cross-customer 403 on GET/PATCH.
  - **Tickets:** create (customer-for-self and staff-on-behalf-of),
    SLA due-date math for a known priority, status transition writes
    history, internal-note isolation from Customer, cross-customer
    403, unassigned-agent 403.
  - **Org scoping:** a Manager scoped to Department A cannot see/PATCH
    a Department B ticket (the exact case a real bug was found in
    during manual testing — TASK-042).
  - **Validation:** one representative 400 case (missing required
    field) to confirm the shared error-shape contract holds.

Out of scope: frontend/component tests, exhaustive per-endpoint
coverage of every field combination, load/performance testing.

## Acceptance criteria

- [ ] `npm test` in `backend/` runs the suite against `test.db`
      without touching `dev.db`.
- [ ] Every case above passes.
- [ ] Deleting/breaking the department-scoping fix from TASK-042 makes
      the org-scoping test fail (proves the test is real, not a
      tautology) — checked once during development, not left in place.
- [ ] Suite runs standalone (`npm install && npx prisma migrate deploy
      --schema ... && npm test` from a clean clone) without depending
      on any state from manual dev-server usage.

## Implementation

`backend/src/app.ts` (new), `backend/src/index.ts` (trimmed),
`backend/vitest.config.ts`, `backend/.env.test`,
`backend/tests/{setup.ts,auth,tickets,customers,org-scoping,validation}.test.ts`.

## Verification

Run `npm test`, confirm all pass; temporarily revert the
TASK-042 fix and confirm the org-scoping test fails, then re-apply and
confirm it passes again (proves the test actually exercises the
boundary, not just that the endpoint returns 200).

## Status: Not Started
