# AZM Support CRM

A multi-role customer support CRM: customers submit and track tickets,
agents resolve them within an SLA, managers see reporting, admins
manage users/config. Gemini assists agents with suggested replies,
ticket summaries, and suggested KB articles, and powers a customer-
facing KB chatbot. UI supports Arabic/English (RTL).

Full specs, architecture, decisions, and verification records live in
[`docs/`](docs/) — start with
[`docs/specs/001-customer-support-crm/spec.md`](docs/specs/001-customer-support-crm/spec.md)
and [`docs/demo-walkthrough.md`](docs/demo-walkthrough.md).

## AI-assisted development

Built with Claude Code, using the [Superpowers](https://github.com/obra/superpowers)
skill framework for spec-driven development: brainstorming → written
spec → implementation plan → subagent-driven execution → task-level
and whole-branch code review before merge. See
[`docs/ai-usage.md`](docs/ai-usage.md) for the decision-by-decision
record and [`docs/rubric-evidence.md`](docs/rubric-evidence.md) for
how this process maps to specific artifacts in this repo.

## Stack

- **Backend:** Node.js + TypeScript + Express, Prisma ORM → SQLite
- **Frontend:** React + TypeScript (Vite), React Query, React Router, react-i18next
- **AI:** Google Gemini (`@google/generative-ai`)

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in GEMINI_API_KEY at minimum; SMTP_* optional (falls back to console logging)
npx prisma migrate dev
npm run seed            # creates admin@azmcrm.local / Admin123! and default SLA policies
npm run dev             # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

## Running tests

```bash
cd backend
npm test   # runs the Vitest+Supertest integration suite against an isolated test.db
```

Covers auth, RBAC/ownership boundaries (customer, agent, department
scoping), SLA due-date computation, and the shared validation error
contract — see `docs/specs/001-customer-support-crm/features/19-backend-integration-tests.md`.

## Seeded login

| Role  | Email                | Password    |
|-------|----------------------|-------------|
| Admin | admin@azmcrm.local   | Admin123!   |

Create Agent/Manager accounts via `POST /api/users` (Admin token
required) — there's no dedicated staff-management UI page; the
existing customer/ticket/KB pages are the built UI surfaces. Customers
can self-register at `/register`.

## Guaranteed demo path

Admin login → create agent → create customer → customer creates
ticket → admin assigns → agent uses Gemini suggested reply → resolves
→ customer sees resolution + submits feedback → manager views reports.
Full walkthrough: [`docs/demo-walkthrough.md`](docs/demo-walkthrough.md).

## Known deviation

Runs on SQLite, not SQL Server as originally scoped — the local SQL
Server instance had TCP/IP disabled at the protocol level; switching
back is a one-line `datasource.provider` + `DATABASE_URL` change. See
[`docs/decisions.md`](docs/decisions.md) and
[`docs/debugging-notes.md`](docs/debugging-notes.md).

## Known limitation

Real SMS (Twilio) and WhatsApp (Meta Cloud API) notification channels
are **not implemented** — blocked on provider credentials, not a gap in
scope. The spec is fully written and ready to build the moment
credentials are supplied; see
[`docs/specs/001-customer-support-crm/features/24-real-sms-whatsapp-channels.md`](docs/specs/001-customer-support-crm/features/24-real-sms-whatsapp-channels.md).
Email notifications are fully implemented and send real messages via
SMTP; SMS/WhatsApp currently fall back to console-logging mock
channels only.
