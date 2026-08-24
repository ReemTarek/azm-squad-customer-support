# Per-Feature Specs

One focused spec per P0 feature area — goal, scope, acceptance
criteria, implementation pointers, and verification status. These
complement (not replace) the project-level `spec.md`,
`implementation-plan.md`, and `traceability.md` one level up.

| # | Feature | Requirement(s) |
|---|---|---|
| [01](01-database.md) | Database persistence | CRM-DB-001 |
| [02](02-auth-rbac.md) | Authentication & RBAC | CRM-AUTH-001, CRM-AUTHZ-001 |
| [03](03-customer-management.md) | Customer management | CRM-CUSTOMER-001 |
| [04](04-ticket-management.md) | Ticket management | CRM-TICKET-001, CRM-STATUS-001, CRM-ASSIGN-001, CRM-COMM-001 |
| [05](05-sla.md) | SLA workflow | CRM-SLA-001 |
| [06](06-knowledge-base.md) | Knowledge base | CRM-KB-001 |
| [07](07-gemini-ai.md) | Gemini-assisted replies | CRM-AI-001 |
| [08](08-customer-portal.md) | Customer-facing portal | CRM-PORTAL-001 |
| [09](09-reporting.md) | Basic reporting | CRM-REPORT-001 |
| [10](10-i18n.md) | Arabic/English i18n | CRM-I18N-001 |
| [11](11-responsive-ui.md) | Responsive UI | CRM-UI-001 |
| [12](12-validation-error-handling.md) | Validation & error handling | CRM-VALID-001 |

All 12 are Done as of this writing, except 01-database.md which flags
a known deviation (SQLite substituted for SQL Server) that must be
resolved before CRM-DB-001 is fully satisfied.
