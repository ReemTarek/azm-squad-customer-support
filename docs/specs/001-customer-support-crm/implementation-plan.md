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
| TASK-024 | CRM-CSAT-002 | Customer feedback rating after resolution — **Done**, verified (curl + Playwright): only shown/allowed once Resolved/Closed, one submission per ticket (409 on repeat), cross-customer and Agent submission blocked (403/N/A) |
| TASK-025 | CRM-AUDIT-002 | Audit log UI — **Done**, verified (curl + Playwright): user/customer creation, ticket assignment (manual+auto), and KB publish/unpublish all write entries; Admin-only page with entity-type filter; Agent blocked (403) |
| TASK-026 | CRM-REPORT-002 | Richer reports (SLA breach trends) — **Done**, verified (curl cross-checked against manual DB query + Playwright): SLA breach rate among resolved tickets, tickets-created-per-day bar chart (last 7 days), Agent blocked (403) |

## P2 (interfaces only, do not implement the real integration)

Adapter interfaces for WhatsApp/SMS notification and ERP sync, documented
in `decisions.md`, only if P0+P1 are complete with time remaining.

---

## Post-P1 Enhancements (from full feature-catalog gap analysis, `gap-analysis.md`)

All Done and verified (curl + Playwright, cross-checked against manual
DB queries where numeric). Full detail in
`docs/specs/001-customer-support-crm/gap-analysis.md` and
`docs/verification.md`.

| ID | Requirement | Goal | Status |
|---|---|---|---|
| TASK-027 | CRM-KB-002 | KB search (title/body/category) | Done |
| TASK-028 | CRM-TICKET-003 | Ticket category field (create/filter/display) | Done |
| TASK-029 | CRM-CUSTOMER-003 | Customer interaction-history view (staff-only) | Done |
| TASK-030 | CRM-REPORT-003 | Aggregate CSAT + agent-performance report cards | Done |
| TASK-031 | CRM-AI-003 | AI ticket summary | Done |
| TASK-032 | CRM-AI-004 | AI-suggested KB articles | Done |
| TASK-033 | CRM-SLA-ESCALATE-001 | SLA escalation sweep (bump priority to Urgent on breach) | Done |
| TASK-034 | CRM-NOTIFY-001 | In-app notification badge (breached/at-risk counts) | Done |
| TASK-035 | CRM-INTEGRATION-001 | P2 notification adapter (email/SMS/WhatsApp interface + mocks) | Done |
| TASK-036 | CRM-INTEGRATION-002 | P2 ERP adapter (interface + mock) | Done |

---

## Planned — Approved, Not Yet Built

### TASK-037
**Requirement:** CRM-SLA-CONFIG-001
**Goal:** Admin can edit SLA response/resolution thresholds per priority without a code change.
**Dependencies:** none (extends existing `services/sla.ts`)
**Database:** new `SlaPolicy` model — `priority` (unique enum), `responseMinutes`, `resolutionMinutes`, `updatedAt`. Seeded with the current hardcoded values (Urgent 30/240, High 120/480, Medium 480/1440, Low 1440/4320 minutes).
**Backend:** `GET /admin/sla-config` (Admin only, list all 4 rows), `PATCH /admin/sla-config/:priority` (Admin only, update one row's minutes). `computeSlaDueDates()` reads from the DB instead of the in-code constant map.
**Frontend:** Admin-only "SLA Settings" page — one row per priority with editable response/resolution minute fields, save button.
**Verification:** Change a threshold via UI → create a new ticket at that priority → confirm its due timestamps use the new value. Confirm existing tickets' due dates are unaffected (matches the compute-on-write architecture — no retroactive recompute). Non-admin blocked (403).
**Status:** Done — see `features/15-sla-configuration.md` for full verification detail.

### TASK-038
**Requirement:** CRM-CUSTOMER-004
**Goal:** Staff can leave internal notes on a customer's profile, separate from ticket messages (e.g. "VIP customer", "prefers phone contact").
**Dependencies:** none (extends existing customer detail page)
**Database:** new `CustomerNote` model — `customerId` (FK → User), `authorId` (FK → User), `body`, `createdAt`.
**Backend:** `GET /customers/:id/notes` (Admin/Manager/Agent), `POST /customers/:id/notes` (Admin/Manager/Agent).
**Frontend:** "Notes" section on the customer detail page (staff-only), list in reverse-chronological order with author name, simple add form.
**Verification:** Staff adds a note → visible to other staff on reload → Customer role cannot see it (403 or simply never rendered/never fetched, matching the internal-note pattern already used for tickets). Non-staff blocked.
**Status:** Done — see `features/16-customer-notes.md` for full verification detail.

Explicitly out of scope for both: file attachments (materially more work
— storage, size limits, type validation), note editing/deletion,
per-department SLA policies (see discussion items below).

---

## Approved Big-Scope Items (decided 2026-08-24)

Both are genuinely large — comparable in size to a P0-era feature —
and modify security-sensitive or previously-unbuilt subsystems. Full
task breakdown lives in their feature spec files; summarized here for
traceability.

### Multi-Department / Multi-Branch (full RBAC)
**Requirement:** CRM-ORG-001 · **Spec:** `features/17-multi-department-branch.md`

| ID | Goal | Status |
|---|---|---|
| TASK-039 | Department/Branch schema + nullable FKs on User/Ticket | Done |
| TASK-040 | Backend RBAC scoping (Manager scoped to own dept/branch) + admin CRUD | Done |
| TASK-041 | Frontend pickers/filters + admin management page | Done |
| TASK-042 | Reports breakdown by department/branch | Done |
| TASK-043 | **Required** regression re-verification of the full P0 security suite | Done — no regressions |

See `features/17-multi-department-branch.md` for full verification
detail, the scope note on why Agent/customers weren't dept-scoped, and
a real bug found+fixed (reports department breakdown leaking data for
a scoped Manager — `docs/debugging-notes.md`).

### AI Chatbot (full, non-streaming — see spec for the scoping decision)
**Requirement:** CRM-AI-005 · **Spec:** `features/18-ai-chatbot.md`

| ID | Goal | Status |
|---|---|---|
| TASK-044 | ChatConversation/ChatMessage schema | Done |
| TASK-045 | Backend endpoints + KB-grounded Gemini answering | Done |
| TASK-046 | Customer portal chat widget + ticket hand-off | Done |
| TASK-047 | Guardrails against fabricated answers | Done |

See `features/18-ai-chatbot.md` for full verification detail — both
the grounded-answer and honest-fallback cases confirmed against the
real Gemini API, no hallucination observed.

## Decided, Not Building

- **Custom branding** — user decision to skip (was the lowest-risk
  discussion item). `features/discussion-custom-branding.md`.

## Real Communication Providers — credentials pending

Architecture already built (TASK-035/036). Email → Gmail/Google SMTP
(user to provide an app password); SMS → Twilio; WhatsApp → Meta Cloud
API. Directions for obtaining each credential are in
`features/discussion-real-communication-providers.md`. No code changes
until credentials arrive.
