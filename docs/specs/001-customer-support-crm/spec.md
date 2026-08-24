# Customer Support CRM — Specification

## Purpose

A multi-role customer support CRM: customers submit and track support
tickets, agents resolve them within an SLA, managers see reporting, and
admins manage users/config. Gemini assists agents with suggested
replies. UI supports Arabic/English.

Each P0 feature area also has its own focused spec (goal, scope,
acceptance criteria, implementation pointers, verification status) in
[`features/`](features/README.md).

## Actors

| Role     | Can do |
|----------|--------|
| Admin    | Manage users, agents, customers, KB, view all tickets/reports |
| Manager  | View reports/dashboards, view all tickets, reassign tickets |
| Agent    | View/respond to assigned tickets, use KB, use Gemini suggestions |
| Customer | Create tickets, view/reply to own tickets, browse KB, give feedback |

## Requirements

IDs are referenced from architecture/data-model/api-contract/plan/traceability docs.

### P0 — must work for demo

| ID | Requirement |
|----|-------------|
| CRM-AUTH-001 | Register/login with email+password; JWT access+refresh tokens |
| CRM-AUTHZ-001 | Role-based authorization enforced on every protected route |
| CRM-CUSTOMER-001 | Admin/Agent can create, view, list, update customers |
| CRM-TICKET-001 | Create ticket (customer or agent-on-behalf), view ticket detail, list tickets |
| CRM-ASSIGN-001 | Admin/Manager manually assigns a ticket to an agent |
| CRM-STATUS-001 | Ticket status transitions (Open→In Progress→Resolved→Closed) recorded as history |
| CRM-COMM-001 | Threaded ticket messages; agent-only internal notes vs customer-visible replies |
| CRM-DASH-001 | Agent dashboard: tickets assigned to me, filterable by status/priority |
| CRM-DB-001 | All persistence via Prisma against a relational database (SQLite — see decisions.md for why this replaced the originally-planned SQL Server) |
| CRM-VALID-001 | Input validation + structured error responses on all write endpoints |
| CRM-SLA-001 | Ticket priority determines response/resolution due timestamps; SLA state (on_track/at_risk/breached) computed and shown |
| CRM-KB-001 | Knowledge base articles: CRUD (agent/admin), browse/search (all roles) |
| CRM-AI-001 | Gemini "Suggest Reply" on a ticket, using ticket+thread context |
| CRM-PORTAL-001 | Customer-facing flow: submit ticket, view own tickets, reply, see KB |
| CRM-REPORT-001 | Basic reporting: counts by status, avg resolution time, tickets per agent |
| CRM-I18N-001 | Arabic/English UI switch incl. RTL layout |
| CRM-UI-001 | Responsive, usable UI across the above flows |

### P1 — after P0 is fully verified

| ID | Requirement |
|----|-------------|
| CRM-TASK-002 | Agent tasks/reminders on a ticket |
| CRM-QUICKREPLY-002 | Saved quick-reply templates |
| CRM-SLA-002 | Richer SLA automation (e.g. escalation flag) |
| CRM-ASSIGN-002 | Automatic assignment strategy (e.g. least-loaded agent) |
| CRM-CSAT-002 | Customer satisfaction rating after resolution |
| CRM-AUDIT-002 | Audit-log UI (list/filter of who-did-what) |
| CRM-ADMIN-002 | Expanded admin (role/permission editing) |
| CRM-REPORT-002 | Richer reports (SLA breach trends, per-period) |

### Approved post-P1 additions (from full feature-catalog gap analysis, `gap-analysis.md`)

| ID | Requirement |
|----|-------------|
| CRM-KB-002 | KB search |
| CRM-TICKET-003 | Ticket category field |
| CRM-CUSTOMER-003 | Customer interaction-history view |
| CRM-REPORT-003 | Aggregate CSAT + agent-performance reports |
| CRM-AI-003 | AI ticket summary |
| CRM-AI-004 | AI-suggested KB articles |
| CRM-SLA-ESCALATE-001 | SLA escalation sweep |
| CRM-NOTIFY-001 | In-app notification badge |
| CRM-INTEGRATION-001 | P2 notification adapter (interface + mocks) |
| CRM-INTEGRATION-002 | P2 ERP adapter (interface + mock) |
| CRM-SLA-CONFIG-001 | Admin-editable SLA configuration — Not Started |
| CRM-CUSTOMER-004 | Customer notes — Not Started |

### P2 — do not let these consume the deadline

Real WhatsApp/SMS/ERP providers, real-time chat infra, complex branding
engine, vector DB, microservices, infra automation. Where relevant, a
clean adapter interface is implemented and documented, not the real
integration (no credentials, out of scope for 3 days).

## Out of scope

Multi-tenancy, billing, payment processing, mobile apps, production
deployment/infra automation, SSO/OAuth login.

## Success criteria

The end-to-end demo path in `docs/demo-walkthrough.md` runs start to
finish against a real database (SQLite — see decisions.md), with the
negative/security cases in `docs/verification.md` passing.
