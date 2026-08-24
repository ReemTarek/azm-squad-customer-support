# Implementation Plan

Feature-slice tasks. P0 tasks (TASK-001..020) must all be Done, verified
end-to-end, before any P1 task starts. Status is updated in place as
work proceeds — this file is the live source of truth for progress.

---

### TASK-001
**Requirement:** CRM-DB-001
**Goal:** Confirm the backend can actually connect to local SQL Server (Windows Auth) via Prisma before building anything on top of it — this is the one unverified assumption from the design.
**Dependencies:** none
**Database:** create `AzmSupportCrm` database if missing.
**Backend:** `npm init` backend project, install Prisma, minimal `schema.prisma` with one throwaway model, run `prisma migrate dev`.
**Frontend:** none
**Verification:** migration succeeds against the real local SQL Server instance; if `integratedSecurity=true` fails, fall back to a SQL-auth login and update `.env`/`architecture.md` accordingly.
**Status:** Done — local SQL Server has TCP/IP disabled at the protocol level (not an auth issue), needing an admin-elevated fix. Switched to SQLite (`backend/prisma/schema.prisma` provider `sqlite`) as the **permanent** choice per user decision, not a stopgap — verified with a real create+read round trip. See `docs/decisions.md` and `docs/debugging-notes.md`.

### TASK-002
**Requirement:** CRM-DB-001, CRM-CUSTOMER-001, CRM-TICKET-001, CRM-STATUS-001, CRM-COMM-001, CRM-KB-001
**Goal:** Full P0 Prisma schema in place.
**Dependencies:** TASK-001
**Database:** `schema.prisma` — User, CustomerProfile, Ticket, TicketMessage, TicketStatusHistory, KnowledgeBaseArticle (per data-model.md); initial migration; seed script for SLA priority config + one Admin user.
**Backend:** Prisma client wired into an `db.ts` singleton.
**Frontend:** none
**Verification:** `prisma studio` or a query script shows tables created; seed script runs and creates the admin row.
**Status:** Done — full P0 schema migrated (SQLite, per TASK-001); seed script creates `admin@azmcrm.local` / `Admin123!`; verified via query script (user/ticket/kb tables all queryable, admin role correct). SLA priority config implemented as an in-code constant map (`backend/src/services/sla.ts`) rather than a DB table, per data-model.md's "not user-editable in P0."

### TASK-003
**Requirement:** CRM-AUTH-001
**Goal:** Register/login/refresh working end-to-end.
**Dependencies:** TASK-002
**Backend:** `POST /auth/register`, `/login`, `/refresh`; bcrypt hashing; JWT sign/verify helpers.
**Frontend:** Login page, register page (or seed-only for staff — Customer self-registers), token storage, axios/fetch wrapper attaching bearer token and refreshing on 401.
**Verification:** Register a customer via UI → login → see authenticated dashboard shell. Invalid credentials → clear error, no token issued.
**Status:** Done — verified via Playwright against the live dev servers: unauthenticated visit redirects to /login; register → lands on dashboard shell with correct name/role; logout → login with same credentials → dashboard again; wrong password → inline "Invalid email or password" error, stays on /login. Also curl-verified: duplicate email → 409, missing fields → 400 with field details, refresh token rotation works, garbage refresh token → 401.

### TASK-004
**Requirement:** CRM-AUTHZ-001
**Goal:** RBAC enforced on every protected route.
**Dependencies:** TASK-003
**Backend:** `requireAuth` + `requireRole([...])` middleware; apply across all route files as they're built (this task establishes the pattern + a couple of test routes).
**Frontend:** route guards redirect unauthenticated/wrong-role users.
**Verification:** Agent token hitting an Admin-only route → 403. No token → 401. Expired token → 401.
**Status:** Done — `requireAuth`/`requireRole` established and proven on `/api/users` routes: no token → 401, garbage token → 401, Customer token on Admin-only `GET /users` → 403, Customer token on own `/users/me` → 200, Admin token can list users and create an Agent account. Pattern will be reused as-is on tickets/KB/reports routes.

### TASK-005
**Requirement:** CRM-CUSTOMER-001
**Goal:** Customer management end-to-end.
**Dependencies:** TASK-004
**Backend:** `/customers` CRUD per api-contract.md.
**Frontend:** Customer list page, create/edit form, customer detail page.
**Verification:** Create a customer via UI → confirm row in SQL Server → appears in list.
**Status:** Done — verified via Playwright: Admin creates a customer through the UI → lands on detail page → edits company field → saved, persists on reload; new customer appears in the list. Backend cross-customer ownership check also curl-verified (Customer viewing another customer's record → 403, own record → 200).

### TASK-006
**Requirement:** CRM-TICKET-001
**Goal:** Ticket creation + retrieval end-to-end.
**Dependencies:** TASK-005
**Backend:** `POST /tickets`, `GET /tickets`, `GET /tickets/:id` with ownership scoping.
**Frontend:** Ticket creation form, ticket list, ticket detail page (read-only for now).
**Verification:** Create a ticket via UI as a customer → confirm persisted row → visible in agent's ticket list.
**Status:** Done — verified via curl (Admin creates on-behalf-of-customer, Customer creates for self, validation errors on bad priority/missing subject) and Playwright (Admin creates a ticket through the UI, lands on detail page).

### TASK-007
**Requirement:** CRM-STATUS-001
**Goal:** Status transitions recorded as history.
**Dependencies:** TASK-006
**Backend:** `PATCH /tickets/:id` (status/priority), writes TicketStatusHistory row; recomputes SLA due timestamps on priority change.
**Frontend:** Status dropdown/buttons on ticket detail; history timeline component.
**Verification:** Change status via UI → history entry appears → status persists on reload.
**Status:** Done — verified via curl (Open→InProgress→Resolved, history shows all 3 entries with correct from/to/changedBy) and Playwright (agent changes status via UI, history list updates, customer sees the same history).

### TASK-008
**Requirement:** CRM-ASSIGN-001
**Goal:** Manual assignment to an agent.
**Dependencies:** TASK-007
**Backend:** `POST /tickets/:id/assign`.
**Frontend:** Assign-to-agent dropdown (Admin/Manager view).
**Verification:** Assign via UI → ticket appears in that agent's dashboard.
**Status:** Done — verified via curl and Playwright: Admin assigns a ticket to an agent via the dropdown, ticket appears when that agent's account queries /tickets (server-side scoped to assignedAgentId=self for Agent role, regardless of query params — an unassigned agent gets 403 on PATCH attempts).

### TASK-009
**Requirement:** CRM-COMM-001
**Goal:** Threaded messages incl. internal notes.
**Dependencies:** TASK-008
**Backend:** `POST/GET /tickets/:id/messages`; Customer requests never return `isInternalNote=true` rows.
**Frontend:** Message thread UI with a distinct visual style for internal notes; reply box (Customer cannot toggle internal note).
**Verification:** Post an internal note as Agent → confirm it does NOT appear when fetching the same ticket as the owning Customer.
**Status:** Done — verified via curl and Playwright end-to-end: Agent posts one internal note + one customer-visible reply; the owning Customer's message list (API and UI) shows only the visible reply. Customer's reply box has no internal-note checkbox (frontend), and the backend forces isInternalNote=false for Customer regardless of payload (defense in depth).

### TASK-010
**Requirement:** CRM-SLA-001
**Goal:** SLA due timestamps + state visible.
**Dependencies:** TASK-007
**Backend:** SLA calc service (priority → due timestamps), derived state on read.
**Frontend:** SLA badge (on_track/at_risk/breached) on ticket list + detail.
**Verification:** Create Urgent ticket, manually backdate `createdAt` in DB, confirm state shows `breached`.
**Status:** Done — verified: a normal Urgent ticket reports `on_track`; a ticket created directly in the DB with `resolutionDueAt` 1 hour in the past reports `breached` via the API. SLA badge renders correctly in the UI (green/amber/red) on both list and detail views.

### TASK-011
**Requirement:** CRM-DASH-001
**Goal:** Agent dashboard.
**Dependencies:** TASK-008, TASK-010
**Backend:** `GET /tickets?assignedAgentId=me&status=...` filtering (reuses TASK-006 endpoint).
**Frontend:** Agent dashboard page — assigned tickets, status/priority filters, SLA badges.
**Verification:** Login as agent with 2+ assigned tickets → dashboard lists exactly those, filterable.
**Status:** Done — the single `/tickets` list page doubles as the agent dashboard: backend always scopes an Agent's query to their own assignedAgentId, so no separate dashboard route was needed. Status/priority filters verified via UI (select dropdowns re-query).

### TASK-012
**Requirement:** CRM-KB-001
**Goal:** Knowledge base CRUD + browse.
**Dependencies:** TASK-004
**Backend:** `/kb` routes per api-contract.md.
**Frontend:** KB list/search (all roles), article detail, create/edit form (Agent/Admin).
**Verification:** Create unpublished article → not visible to Customer; publish → visible.
**Status:** Done — verified via curl (unpublished hidden from list + direct GET 404 for Customer) and Playwright (Agent creates draft → publishes → Customer sees it in KB list, no "New Article" button for Customer).

### TASK-013
**Requirement:** CRM-AI-001
**Goal:** Gemini suggested reply on a ticket.
**Dependencies:** TASK-009
**Backend:** `services/gemini.ts` + `POST /tickets/:id/suggest-reply`; 503 `AI_UNAVAILABLE` if key missing/errors.
**Frontend:** "Suggest Reply" button on ticket detail → populates reply box (editable before send).
**Verification:** Click button on a real ticket → get a real Gemini-generated draft; unset `GEMINI_API_KEY` and confirm graceful 503, not a crash.
**Status:** Done — verified with the real Gemini API: clicking "Suggest Reply" in the UI populates the reply textarea with a contextually relevant draft (references the actual ticket subject and internal note context). Blanking `GEMINI_API_KEY` and restarting returns 503 `AI_UNAVAILABLE` with the server staying healthy (see debugging-notes.md for the model-name issue hit and fixed along the way).

### TASK-014
**Requirement:** CRM-PORTAL-001
**Goal:** Full customer-facing flow polished as one cohesive path.
**Dependencies:** TASK-006, TASK-009, TASK-012
**Backend:** none new (reuses existing endpoints).
**Frontend:** Customer portal shell — my tickets, new ticket, ticket detail+reply, KB browse.
**Verification:** As a Customer: submit ticket → reply → browse KB, all working, cannot see other customers' tickets (403) or internal notes.
**Status:** Done — no new code needed, existing role-scoped screens compose into the full portal already. Verified via Playwright: self-register → nav shows only Tickets/KB (no Customers link) → submit own ticket → reply on it → browse KB, zero console errors end to end.

### TASK-015
**Requirement:** CRM-REPORT-001
**Goal:** Basic reporting dashboard.
**Dependencies:** TASK-010
**Backend:** `GET /reports/summary` (aggregate Prisma queries).
**Frontend:** Manager report page — counts by status/priority, avg resolution time, tickets per agent (simple table/cards, no charting library required).
**Verification:** Numbers on the report page match a manual count from the DB for a small seeded dataset.
**Status:** Done — verified via a manual Prisma groupBy script matching the API's byStatus counts exactly (InProgress:1, Open:3, Resolved:1 against 5 total tickets), and Playwright (admin sees the report cards; Agent has no Reports nav link and gets 403 hitting the endpoint directly).

### TASK-016
**Requirement:** CRM-I18N-001
**Goal:** Arabic/English switch incl. RTL.
**Dependencies:** TASK-014 (needs real screens to translate)
**Backend:** none (locale stored on User, returned in `/auth/login` response).
**Frontend:** react-i18next setup, `en`/`ar` bundles for core screens, language switcher, RTL layout toggle.
**Verification:** Switch to Arabic → layout mirrors to RTL, key strings translated, switch back to English works.
**Status:** Done — verified via Playwright: switching to Arabic flips `<html dir>` to rtl, mirrors the header layout, translates nav/login/register/dashboard/tickets screens (incl. interpolated "Welcome, {{name}}"), navigating via the translated nav link works, switching back to English restores ltr. Language choice persisted in localStorage.

### TASK-017
**Requirement:** CRM-UI-001
**Goal:** Responsive pass across the flows above.
**Dependencies:** TASK-011, TASK-014, TASK-015
**Frontend:** Responsive layout check/fixes (mobile/tablet/desktop) on dashboard, ticket detail, portal, reports.
**Verification:** Manual check at 3 breakpoints per screen; no horizontal scroll/overlap.
**Status:** Done — Playwright checked scrollWidth vs clientWidth at 375px/768px/1440px across dashboard, tickets, customers, reports. Found and fixed one real issue: the header didn't wrap on narrow screens, pushing nav off-canvas (375px page scrollWidth was 657px). Added flex-wrap to header/nav/user-menu and an overflow-x:auto wrapper around data tables (min-width 480px) so wide tables scroll internally instead of the page. Re-checked: 0px horizontal overflow on all 12 combinations.

### TASK-018
**Requirement:** CRM-VALID-001
**Goal:** Consistent validation/error handling across all write endpoints.
**Dependencies:** all backend tasks above
**Backend:** zod schemas per endpoint, central error middleware, standard error shape (api-contract.md).
**Verification:** Missing required field / bad enum value on each write endpoint → 400 with field-level detail, not a 500.
**Status:** Done — every write endpoint (auth, users, customers, tickets incl. assign/messages, kb) tested with bad/missing input, all return 400 VALIDATION_ERROR with field-level details via the shared zod+error-middleware pattern, never a 500. Also confirmed: nonexistent resource → 404, duplicate email → 409, assigning a non-Agent user to a ticket → 400 with a clear message.

### TASK-019
**Requirement:** all P0
**Goal:** Security/edge-case verification pass (docs/verification.md).
**Dependencies:** TASK-001..018
**Verification:** Execute the full negative-case list in `docs/verification.md`; fix anything that fails.
**Status:** Done — full negative-case list executed (see `docs/verification.md`): invalid credentials, missing/expired/malformed JWT, wrong-role access, cross-customer/cross-agent access, invalid priority/status/role references, nonexistent resources, duplicate email, empty search, Gemini disabled. All PASS. Attachments (invalid/oversized) are not in P0 scope — no attachment feature was specced or built, so this generic case doesn't apply here.

### TASK-020
**Requirement:** all P0
**Goal:** Demo walkthrough dry run.
**Dependencies:** TASK-019
**Verification:** Run the full path in `docs/demo-walkthrough.md` start to finish without manual DB edits (except the SLA backdating case, which is an explicit test step).
**Status:** Done — full guaranteed demo path executed via Playwright: admin login → create agent → create customer → create ticket → assign → agent login → view ticket → Gemini suggested reply → send reply → status→InProgress→Resolved → SLA badge visible throughout → customer sees Resolved status and the agent's reply → admin views report. Zero console errors. Customer feedback (P1) explicitly skipped as out of P0 scope. One real (minor) UX bug found and fixed along the way — see debugging-notes.md.

---

## P1 (only after all P0 tasks are Done)

| ID | Requirement | Goal |
|---|---|---|
| TASK-021 | CRM-TASK-002 | Agent tasks/reminders on a ticket — **Done**, verified (curl + Playwright): create/list/complete tasks scoped to a ticket, Agent restricted to their own tasks, Customer blocked (403) |
| TASK-022 | CRM-QUICKREPLY-002 | Saved quick-reply templates — **Done**, verified (curl + Playwright): create/list/delete quick replies, Customer blocked (403), inserted into a ticket's reply box from the detail page |
| TASK-023 | CRM-ASSIGN-002 | Automatic assignment (least-loaded agent) — **Done**, verified (curl + Playwright): picks the Agent with fewest open/in-progress tickets, ties broken by earliest-created agent; Agent role blocked (403) |
| TASK-024 | CRM-CSAT-002 | Customer feedback rating after resolution |
| TASK-025 | CRM-AUDIT-002 | Audit log UI |
| TASK-026 | CRM-REPORT-002 | Richer reports (SLA breach trends) |

## P2 (interfaces only, do not implement the real integration)

Adapter interfaces for WhatsApp/SMS notification and ERP sync, documented
in `decisions.md`, only if P0+P1 are complete with time remaining.
