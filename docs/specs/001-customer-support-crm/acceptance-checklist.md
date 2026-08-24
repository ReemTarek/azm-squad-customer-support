# Acceptance Checklist (P0)

A checkbox is ticked only after manual/integration verification, not
just code existing. Mirrors `docs/verification.md` results.

- [x] Register + login as Customer, Agent, Admin, Manager (seeded)
- [x] Wrong password / nonexistent email → clear 401, no token
- [x] Expired/invalid JWT on a protected route → 401
- [x] Agent hitting an Admin-only route → 403
- [x] Admin creates a Customer → persisted, visible in list (SQLite — see decisions.md for why this replaced SQL Server)
- [x] Customer creates a ticket → persisted, visible to Admin/Manager, NOT visible to other customers
- [x] Ticket status change → history entry recorded, visible on detail page
- [x] Admin/Manager assigns ticket to Agent → appears on that Agent's dashboard
- [x] Agent posts internal note → hidden from Customer view of same ticket
- [x] Customer posts a reply → visible to assigned Agent
- [x] SLA badge shows on_track for a fresh ticket, breached after backdating
- [x] KB article: unpublished hidden from Customer, published visible to all
- [x] Gemini "Suggest Reply" returns a real suggestion on a live ticket
- [x] Gemini disabled (no key) → 503 with clear message, server does not crash
- [x] Manager report page numbers match a manual DB count on seed data
- [x] UI switches en↔ar, RTL layout applied, key strings translated
- [x] Core screens usable at mobile/tablet/desktop widths
- [x] Every write endpoint returns 400 with field details on bad input, not 500
- [x] Full demo path (`docs/demo-walkthrough.md`) runs start to finish

All P0 acceptance criteria verified. Database runs on SQLite by
deliberate final decision (see
`docs/specs/001-customer-support-crm/features/01-database.md`), not a
pending item.
