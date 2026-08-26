# Per-Feature Specs

One focused spec per feature area — goal, assumptions, scope,
acceptance criteria, implementation pointers, and verification status.
These complement (not replace) the project-level `spec.md`,
`implementation-plan.md`, and `traceability.md` one level up.

The **Spec timing** column matters for assessment purposes: it shows
whether the spec was written and (where applicable) user-approved
*before* implementation started, which is the SDD discipline this
project aims to follow consistently. See
`docs/rubric-evidence.md` for the full honest account of where that
held and where it didn't, and `docs/decisions.md` for the specific
process-gap entry.

| # | Feature | Requirement(s) | Spec timing |
|---|---|---|---|
| [01](01-database.md) | Database persistence | CRM-DB-001 | Before (P0 design phase) |
| [02](02-auth-rbac.md) | Authentication & RBAC | CRM-AUTH-001, CRM-AUTHZ-001 | Before |
| [03](03-customer-management.md) | Customer management | CRM-CUSTOMER-001 | Before |
| [04](04-ticket-management.md) | Ticket management | CRM-TICKET-001, CRM-STATUS-001, CRM-ASSIGN-001, CRM-COMM-001 | Before |
| [05](05-sla.md) | SLA workflow | CRM-SLA-001 | Before |
| [06](06-knowledge-base.md) | Knowledge base | CRM-KB-001 | Before |
| [07](07-gemini-ai.md) | Gemini-assisted replies | CRM-AI-001 | Before |
| [08](08-customer-portal.md) | Customer-facing portal | CRM-PORTAL-001 | Before (composition of already-spec'd pieces) |
| [09](09-reporting.md) | Basic reporting | CRM-REPORT-001 | Before |
| [10](10-i18n.md) | Arabic/English i18n | CRM-I18N-001 | Before |
| [11](11-responsive-ui.md) | Responsive UI | CRM-UI-001 | Before |
| [12](12-validation-error-handling.md) | Validation & error handling | CRM-VALID-001 | Before |
| [13](13-integration-adapters.md) | External integration adapters (P2) | none numbered | **After** — see process note in the file |
| [14a](14a-kb-search.md) | KB search | CRM-KB-002 | **After** — see process note |
| [14b](14b-ticket-category.md) | Ticket category field | CRM-TICKET-003 | **After** |
| [14c](14c-customer-interaction-history.md) | Customer interaction history | CRM-CUSTOMER-003 | **After** |
| [14d](14d-csat-agent-performance-reports.md) | Aggregate CSAT + agent performance | CRM-REPORT-003 | **After** |
| [14e](14e-ai-ticket-summary.md) | AI ticket summary | CRM-AI-003 | **After** |
| [14f](14f-ai-suggested-kb-articles.md) | AI-suggested KB articles | CRM-AI-004 | **After** |
| [14g](14g-sla-escalation-sweep.md) | SLA escalation sweep | CRM-SLA-ESCALATE-001 | **After** |
| [14h](14h-in-app-notifications.md) | In-app notification badge | CRM-NOTIFY-001 | **After** |
| [15](15-sla-configuration.md) | Admin-editable SLA configuration | CRM-SLA-CONFIG-001 | **Before** (written + shown to user prior to code) |
| [16](16-customer-notes.md) | Customer notes | CRM-CUSTOMER-004 | **Before** |
| [17](17-multi-department-branch.md) | Multi-department/branch (full RBAC) | CRM-ORG-001 | **Before** (design options presented, user chose one, then spec written, then code) |
| [18](18-ai-chatbot.md) | AI chatbot (full, non-streaming) | CRM-AI-005 | **Before** (same as 17) |
| [19](19-backend-integration-tests.md) | Backend integration test suite | CRM-TEST-001 | **Before** (spec + `writing-plans` implementation plan written and self-reviewed before any test code, then executed via `subagent-driven-development`) |
| [20](20-bootstrap-responsive-redesign.md) | Bootstrap responsive redesign | CRM-UI-002 | **Before** |
| [21](21-staff-user-management.md) | Staff & user management UI | CRM-ADMIN-003 | **Before** |
| [22](22-attachments.md) | Customer/ticket attachments | CRM-ATTACH-001 | **Before** |
| [23](23-new-message-notifications.md) | New-message customer notifications | CRM-NOTIFY-002 | **Before** |
| [24](24-real-sms-whatsapp-channels.md) | Real SMS/WhatsApp channels | CRM-INTEGRATION-003 | **Before** — blocked on credentials |
| [25](25-live-chat.md) | Live chat (agent ↔ customer) | CRM-LIVECHAT-001 | **Before** |
| [26](26-ai-auto-categorization.md) | AI automatic ticket categorization | CRM-AI-006 | **Before** |
| [27](27-ai-usage-dashboard.md) | AI usage dashboard | CRM-AI-007 | **Before** |
| [28](28-custom-branding.md) | Custom branding | CRM-BRAND-001 | **Before** — reverses the earlier decline below |

01-18 are Done, except 01-database.md which records one deliberate
deviation from the original wording of CRM-DB-001 (SQLite instead of
SQL Server, by final user decision — not a pending item). 19 is Done.
20-28 ("Round 2", see `implementation-plan.md`) were spec'd ahead of
any code on 2026-08-24, following this project's spec-first discipline
throughout. 20 (Bootstrap responsive redesign) is Done as of
2026-08-25 (built via `superpowers:subagent-driven-development` — 7
tasks + a final whole-branch review with one fix wave). 21 (Staff &
user management UI) is Done as of 2026-08-25 (3 tasks + a final
whole-branch review with one fix wave — caught and closed a real
deactivation-bypass via the token-refresh endpoint and an unrecoverable
last-Admin-lockout gap). 22 (Customer/ticket attachments) is Done as
of 2026-08-25 (4 tasks — one went through its own fix round — + a
final whole-branch review with one fix wave — caught and closed an
orphan-file disk-fill vector, a production-path storage bug, and a
client-spoofable file-type gate). 23 (New-message customer
notifications) is Done as of 2026-08-25 (2 tasks + a final
whole-branch review with one fix wave — caught and closed a
failure-isolation gap that could 500 an already-saved message, and
added SMTP transport timeouts before this pattern's exposure grew
from a rare status transition to every staff reply). 25 (Live chat) was
already Done from prior work; verification confirmed Socket.IO
messaging, room scoping, and RBAC enforcement all functional. 26 (AI
automatic ticket categorization) is Done as of 2026-08-26 (2 tasks +
a final whole-branch review with one fix wave — caught and closed a
real coverage gap where the "Gemini unavailable" test never actually
exercised that path (an empty existing-categories list short-circuited
before Gemini was called), plus a real, working `GEMINI_API_KEY`
leaking from `backend/.env` into every test run). 27 (AI usage dashboard)
is Done as of 2026-08-26 (5 tasks — schema, instrumentation, endpoints,
frontend, and closeout — all approved with zero unresolved findings
beyond one pre-existing out-of-scope Minor noted on Task 4). 28 (Custom
branding) is Done as of 2026-08-26 (5 tasks — schema/backend, frontend
provider + Layout/LoginPage integration, the Admin settings page, and
a final closeout — all approved with zero blocking issues; the
closeout task's live Playwright verification confirmed genuine
computed-style button re-tinting, not just a CSS-variable check, plus
cross-page, hard-refresh, and pre-login persistence, and a full
clear-and-revert with no leftover DOM artifacts). 24 remains blocked on
credentials (SMS/WhatsApp) — it is the only Round 2 item still
outstanding.

[Custom branding](discussion-custom-branding.md) was originally
discussed and **decided against** — see that file for the original
reasoning. **Reversed 2026-08-24:** the user asked to revisit it; now
spec'd as [28](28-custom-branding.md).
[Real communication providers](discussion-real-communication-providers.md)
are approved (email/SMS/WhatsApp) pending credentials — see that file
for how to obtain each one; the email channel is code-complete and
sending real email as of 2026-08-24. SMS/WhatsApp are formally spec'd
as [24](24-real-sms-whatsapp-channels.md), still blocked on credentials.
