# Traceability Matrix (P0)

| Requirement | DB Model | API Endpoint | Frontend | Verification |
|---|---|---|---|---|
| CRM-AUTH-001 | User | POST /auth/register, /login, /refresh | Login/Register pages | TASK-003 checklist |
| CRM-AUTHZ-001 | User.role | requireAuth/requireRole middleware (all routes) | route guards | TASK-004 checklist |
| CRM-CUSTOMER-001 | User, CustomerProfile | /customers CRUD | Customer list/detail/form | TASK-005 checklist |
| CRM-TICKET-001 | Ticket | POST/GET /tickets, /tickets/:id | Ticket create/list/detail | TASK-006 checklist |
| CRM-STATUS-001 | Ticket, TicketStatusHistory | PATCH /tickets/:id | Status control + history timeline | TASK-007 checklist |
| CRM-ASSIGN-001 | Ticket.assignedAgentId | POST /tickets/:id/assign | Assign dropdown | TASK-008 checklist |
| CRM-COMM-001 | TicketMessage | POST/GET /tickets/:id/messages | Message thread | TASK-009 checklist |
| CRM-SLA-001 | Ticket (due timestamps) | derived in GET /tickets, /tickets/:id | SLA badge | TASK-010 checklist |
| CRM-DASH-001 | Ticket (query) | GET /tickets?assignedAgentId=me | Agent dashboard | TASK-011 checklist |
| CRM-KB-001 | KnowledgeBaseArticle | /kb CRUD | KB list/detail/form | TASK-012 checklist |
| CRM-AI-001 | Ticket, TicketMessage (context) | POST /tickets/:id/suggest-reply | Suggest Reply button | TASK-013 checklist |
| CRM-PORTAL-001 | Ticket, TicketMessage, KnowledgeBaseArticle | reuses above | Customer portal shell | TASK-014 checklist |
| CRM-REPORT-001 | Ticket (aggregate) | GET /reports/summary | Report page | TASK-015 checklist |
| CRM-I18N-001 | User.locale | login response carries locale | i18next + RTL | TASK-016 checklist |
| CRM-UI-001 | — | — | responsive layout pass | TASK-017 checklist |
| CRM-DB-001 | all models | Prisma → SQLite (final choice, see decisions.md) | — | TASK-001/002 checklist |
| CRM-VALID-001 | — | zod schemas + error middleware | form validation errors | TASK-018 checklist |
