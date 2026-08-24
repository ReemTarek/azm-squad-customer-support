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
**Status:** Not Started

### TASK-002
**Requirement:** CRM-DB-001, CRM-CUSTOMER-001, CRM-TICKET-001, CRM-STATUS-001, CRM-COMM-001, CRM-KB-001
**Goal:** Full P0 Prisma schema in place.
**Dependencies:** TASK-001
**Database:** `schema.prisma` — User, CustomerProfile, Ticket, TicketMessage, TicketStatusHistory, KnowledgeBaseArticle (per data-model.md); initial migration; seed script for SLA priority config + one Admin user.
**Backend:** Prisma client wired into an `db.ts` singleton.
**Frontend:** none
**Verification:** `prisma studio` or a query script shows tables created; seed script runs and creates the admin row.
**Status:** Not Started

### TASK-003
**Requirement:** CRM-AUTH-001
**Goal:** Register/login/refresh working end-to-end.
**Dependencies:** TASK-002
**Backend:** `POST /auth/register`, `/login`, `/refresh`; bcrypt hashing; JWT sign/verify helpers.
**Frontend:** Login page, register page (or seed-only for staff — Customer self-registers), token storage, axios/fetch wrapper attaching bearer token and refreshing on 401.
**Verification:** Register a customer via UI → login → see authenticated dashboard shell. Invalid credentials → clear error, no token issued.
**Status:** Not Started

### TASK-004
**Requirement:** CRM-AUTHZ-001
**Goal:** RBAC enforced on every protected route.
**Dependencies:** TASK-003
**Backend:** `requireAuth` + `requireRole([...])` middleware; apply across all route files as they're built (this task establishes the pattern + a couple of test routes).
**Frontend:** route guards redirect unauthenticated/wrong-role users.
**Verification:** Agent token hitting an Admin-only route → 403. No token → 401. Expired token → 401.
**Status:** Not Started

### TASK-005
**Requirement:** CRM-CUSTOMER-001
**Goal:** Customer management end-to-end.
**Dependencies:** TASK-004
**Backend:** `/customers` CRUD per api-contract.md.
**Frontend:** Customer list page, create/edit form, customer detail page.
**Verification:** Create a customer via UI → confirm row in SQL Server → appears in list.
**Status:** Not Started

### TASK-006
**Requirement:** CRM-TICKET-001
**Goal:** Ticket creation + retrieval end-to-end.
**Dependencies:** TASK-005
**Backend:** `POST /tickets`, `GET /tickets`, `GET /tickets/:id` with ownership scoping.
**Frontend:** Ticket creation form, ticket list, ticket detail page (read-only for now).
**Verification:** Create a ticket via UI as a customer → confirm persisted row → visible in agent's ticket list.
**Status:** Not Started

### TASK-007
**Requirement:** CRM-STATUS-001
**Goal:** Status transitions recorded as history.
**Dependencies:** TASK-006
**Backend:** `PATCH /tickets/:id` (status/priority), writes TicketStatusHistory row; recomputes SLA due timestamps on priority change.
**Frontend:** Status dropdown/buttons on ticket detail; history timeline component.
**Verification:** Change status via UI → history entry appears → status persists on reload.
**Status:** Not Started

### TASK-008
**Requirement:** CRM-ASSIGN-001
**Goal:** Manual assignment to an agent.
**Dependencies:** TASK-007
**Backend:** `POST /tickets/:id/assign`.
**Frontend:** Assign-to-agent dropdown (Admin/Manager view).
**Verification:** Assign via UI → ticket appears in that agent's dashboard.
**Status:** Not Started

### TASK-009
**Requirement:** CRM-COMM-001
**Goal:** Threaded messages incl. internal notes.
**Dependencies:** TASK-008
**Backend:** `POST/GET /tickets/:id/messages`; Customer requests never return `isInternalNote=true` rows.
**Frontend:** Message thread UI with a distinct visual style for internal notes; reply box (Customer cannot toggle internal note).
**Verification:** Post an internal note as Agent → confirm it does NOT appear when fetching the same ticket as the owning Customer.
**Status:** Not Started

### TASK-010
**Requirement:** CRM-SLA-001
**Goal:** SLA due timestamps + state visible.
**Dependencies:** TASK-007
**Backend:** SLA calc service (priority → due timestamps), derived state on read.
**Frontend:** SLA badge (on_track/at_risk/breached) on ticket list + detail.
**Verification:** Create Urgent ticket, manually backdate `createdAt` in DB, confirm state shows `breached`.
**Status:** Not Started

### TASK-011
**Requirement:** CRM-DASH-001
**Goal:** Agent dashboard.
**Dependencies:** TASK-008, TASK-010
**Backend:** `GET /tickets?assignedAgentId=me&status=...` filtering (reuses TASK-006 endpoint).
**Frontend:** Agent dashboard page — assigned tickets, status/priority filters, SLA badges.
**Verification:** Login as agent with 2+ assigned tickets → dashboard lists exactly those, filterable.
**Status:** Not Started

### TASK-012
**Requirement:** CRM-KB-001
**Goal:** Knowledge base CRUD + browse.
**Dependencies:** TASK-004
**Backend:** `/kb` routes per api-contract.md.
**Frontend:** KB list/search (all roles), article detail, create/edit form (Agent/Admin).
**Verification:** Create unpublished article → not visible to Customer; publish → visible.
**Status:** Not Started

### TASK-013
**Requirement:** CRM-AI-001
**Goal:** Gemini suggested reply on a ticket.
**Dependencies:** TASK-009
**Backend:** `services/gemini.ts` + `POST /tickets/:id/suggest-reply`; 503 `AI_UNAVAILABLE` if key missing/errors.
**Frontend:** "Suggest Reply" button on ticket detail → populates reply box (editable before send).
**Verification:** Click button on a real ticket → get a real Gemini-generated draft; unset `GEMINI_API_KEY` and confirm graceful 503, not a crash.
**Status:** Not Started

### TASK-014
**Requirement:** CRM-PORTAL-001
**Goal:** Full customer-facing flow polished as one cohesive path.
**Dependencies:** TASK-006, TASK-009, TASK-012
**Backend:** none new (reuses existing endpoints).
**Frontend:** Customer portal shell — my tickets, new ticket, ticket detail+reply, KB browse.
**Verification:** As a Customer: submit ticket → reply → browse KB, all working, cannot see other customers' tickets (403) or internal notes.
**Status:** Not Started

### TASK-015
**Requirement:** CRM-REPORT-001
**Goal:** Basic reporting dashboard.
**Dependencies:** TASK-010
**Backend:** `GET /reports/summary` (aggregate Prisma queries).
**Frontend:** Manager report page — counts by status/priority, avg resolution time, tickets per agent (simple table/cards, no charting library required).
**Verification:** Numbers on the report page match a manual count from the DB for a small seeded dataset.
**Status:** Not Started

### TASK-016
**Requirement:** CRM-I18N-001
**Goal:** Arabic/English switch incl. RTL.
**Dependencies:** TASK-014 (needs real screens to translate)
**Backend:** none (locale stored on User, returned in `/auth/login` response).
**Frontend:** react-i18next setup, `en`/`ar` bundles for core screens, language switcher, RTL layout toggle.
**Verification:** Switch to Arabic → layout mirrors to RTL, key strings translated, switch back to English works.
**Status:** Not Started

### TASK-017
**Requirement:** CRM-UI-001
**Goal:** Responsive pass across the flows above.
**Dependencies:** TASK-011, TASK-014, TASK-015
**Frontend:** Responsive layout check/fixes (mobile/tablet/desktop) on dashboard, ticket detail, portal, reports.
**Verification:** Manual check at 3 breakpoints per screen; no horizontal scroll/overlap.
**Status:** Not Started

### TASK-018
**Requirement:** CRM-VALID-001
**Goal:** Consistent validation/error handling across all write endpoints.
**Dependencies:** all backend tasks above
**Backend:** zod schemas per endpoint, central error middleware, standard error shape (api-contract.md).
**Verification:** Missing required field / bad enum value on each write endpoint → 400 with field-level detail, not a 500.
**Status:** Not Started

### TASK-019
**Requirement:** all P0
**Goal:** Security/edge-case verification pass (docs/verification.md).
**Dependencies:** TASK-001..018
**Verification:** Execute the full negative-case list in `docs/verification.md`; fix anything that fails.
**Status:** Not Started

### TASK-020
**Requirement:** all P0
**Goal:** Demo walkthrough dry run.
**Dependencies:** TASK-019
**Verification:** Run the full path in `docs/demo-walkthrough.md` start to finish without manual DB edits (except the SLA backdating case, which is an explicit test step).
**Status:** Not Started

---

## P1 (only after all P0 tasks are Done)

| ID | Requirement | Goal |
|---|---|---|
| TASK-021 | CRM-TASK-002 | Agent tasks/reminders on a ticket |
| TASK-022 | CRM-QUICKREPLY-002 | Saved quick-reply templates |
| TASK-023 | CRM-ASSIGN-002 | Automatic assignment (least-loaded agent) |
| TASK-024 | CRM-CSAT-002 | Customer feedback rating after resolution |
| TASK-025 | CRM-AUDIT-002 | Audit log UI |
| TASK-026 | CRM-REPORT-002 | Richer reports (SLA breach trends) |

## P2 (interfaces only, do not implement the real integration)

Adapter interfaces for WhatsApp/SMS notification and ERP sync, documented
in `decisions.md`, only if P0+P1 are complete with time remaining.
