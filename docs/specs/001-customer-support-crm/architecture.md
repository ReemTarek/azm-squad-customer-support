# Architecture

## Stack

- **Backend:** Node.js + TypeScript + Express, Prisma ORM → SQLite
  (`backend/dev.db`). Originally planned against SQL Server; switched
  to SQLite after the local SQL Server instance turned out to have
  TCP/IP disabled at the protocol level (admin-elevated fix, out of
  scope for this engagement) — see `docs/debugging-notes.md` and
  `docs/decisions.md`. Prisma's query API is identical across
  providers, so this had no effect on the schema, routes, or business
  logic.
- **Frontend:** React + TypeScript + Vite, React Query (server state),
  React Router, react-i18next (Arabic/English + RTL).
- **Auth:** JWT access token (15m) + refresh token (7d), bcrypt password
  hashing, RBAC middleware per route.
- **AI:** Google Gemini API (`@google/generative-ai`), server-side only
  — the frontend never sees the API key.
- **Repo layout:** single git repo, `/backend`, `/frontend`, `/docs`.

## Component diagram (text)

```
React SPA (frontend/)
   |  fetch (JWT bearer)
   v
Express API (backend/src)
   |-- routes/*        (HTTP layer, validation via zod)
   |-- middleware/      (auth, rbac, error handler)
   |-- services/*       (business logic: tickets, sla, gemini, reports)
   |-- prisma/           (schema, migrations, client)
   v
SQLite (backend/dev.db)

External: Gemini API (called from services/gemini.ts only)
```

## Auth & RBAC

- `POST /api/auth/register`, `/login`, `/refresh` issue/rotate JWTs.
- Every protected route runs `requireAuth` (verifies JWT) then
  `requireRole([...])` (checks `req.user.role`).
- Ownership checks are explicit in service code, not implied by role:
  a Customer role check alone is not enough to view a ticket — the
  service must also confirm `ticket.customerId === req.user.customerId`.
  Same pattern for Agent-scoped views where relevant.

## SLA model

Computed, not scheduled. On ticket create/priority change:
`response_due_at = created_at + priority_response_minutes`,
`resolution_due_at = created_at + priority_resolution_minutes`.
SLA state is derived at read time (`on_track` / `at_risk` if within
20% of due / `breached`). No cron/worker process — avoids infra
automation for a P0 requirement, matches the 3-day scope.

## Gemini integration

`services/gemini.ts` exposes `suggestReply(ticket, messages): Promise<{reply: string}>`.
Called only from `POST /api/tickets/:id/suggest-reply` (Agent/Admin
only). Wrapped in try/catch with a clear error surfaced to the UI if
the API errors or times out (button shows failure state, ticket flow
is unaffected). API key read from `process.env.GEMINI_API_KEY` at
startup; if unset, the endpoint returns 503 with a clear message
instead of crashing the server (documented in `docs/verification.md`
as the "Gemini disabled" case).

## i18n / RTL

`react-i18next` with `en`/`ar` resource bundles. A `LanguageProvider`
sets `document.documentElement.dir` to `rtl` for Arabic and `ltr` for
English; layout uses logical CSS properties (`margin-inline-start`,
etc.) where it matters instead of hardcoded left/right.

## Error handling

Central Express error-handling middleware converts thrown
`AppError(status, code, message)` into a consistent JSON error shape
`{ error: { code, message, details? } }`. Validation errors (zod) map
to 400 with field-level `details`.

## Deployment

Local only for this exercise: `npm run dev` in `backend/` and
`frontend/` separately. No containerization/CI required by P0.
