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

All of the above are Done, except 01-database.md which records one
deliberate deviation from the original wording of CRM-DB-001 (SQLite
instead of SQL Server, by final user decision — not a pending item).

[Custom branding](discussion-custom-branding.md) was discussed and
**decided against** — user chose to skip it.
[Real communication providers](discussion-real-communication-providers.md)
are approved (email/SMS/WhatsApp) pending credentials — see that file
for how to obtain each one; the email channel is code-complete.
