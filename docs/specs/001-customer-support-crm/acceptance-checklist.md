# Acceptance Checklist (P0)

A checkbox is ticked only after manual/integration verification, not
just code existing. Mirrors `docs/verification.md` results.

- [ ] Register + login as Customer, Agent, Admin, Manager (seeded)
- [ ] Wrong password / nonexistent email → clear 401, no token
- [ ] Expired/invalid JWT on a protected route → 401
- [ ] Agent hitting an Admin-only route → 403
- [ ] Admin creates a Customer → persisted in SQL Server, visible in list
- [ ] Customer creates a ticket → persisted, visible to Admin/Manager, NOT visible to other customers
- [ ] Ticket status change → history entry recorded, visible on detail page
- [ ] Admin/Manager assigns ticket to Agent → appears on that Agent's dashboard
- [ ] Agent posts internal note → hidden from Customer view of same ticket
- [ ] Customer posts a reply → visible to assigned Agent
- [ ] SLA badge shows on_track for a fresh ticket, breached after backdating
- [ ] KB article: unpublished hidden from Customer, published visible to all
- [ ] Gemini "Suggest Reply" returns a real suggestion on a live ticket
- [ ] Gemini disabled (no key) → 503 with clear message, server does not crash
- [ ] Manager report page numbers match a manual DB count on seed data
- [ ] UI switches en↔ar, RTL layout applied, key strings translated
- [ ] Core screens usable at mobile/tablet/desktop widths
- [ ] Every write endpoint returns 400 with field details on bad input, not 500
- [ ] Full demo path (`docs/demo-walkthrough.md`) runs start to finish
