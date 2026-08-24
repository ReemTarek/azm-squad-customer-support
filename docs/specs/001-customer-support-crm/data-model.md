# Data Model

Database: **AzmSupportCrm** (SQL Server). Modeled in Prisma; types below
are the conceptual shape — see `backend/prisma/schema.prisma` for the
authoritative source once implemented.

## User
Unified login table for every role (Admin/Manager/Agent/Customer).

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | string, unique | |
| passwordHash | string | bcrypt |
| role | enum(Admin,Manager,Agent,Customer) | |
| name | string | |
| locale | enum(en,ar) | default en |
| createdAt/updatedAt | datetime | |

## CustomerProfile (1:1 with User where role=Customer)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | uuid FK → User, unique | |
| phone | string? | |
| company | string? | |

## Ticket
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customerId | uuid FK → User | ticket owner |
| assignedAgentId | uuid? FK → User | nullable until assigned |
| subject | string | |
| priority | enum(Low,Medium,High,Urgent) | |
| status | enum(Open,InProgress,Resolved,Closed) | |
| responseDueAt | datetime | computed on create/priority change |
| resolutionDueAt | datetime | computed on create/priority change |
| resolvedAt | datetime? | set when status→Resolved |
| createdAt/updatedAt | datetime | |

Constraint: `assignedAgentId` user must have role=Agent (app-level check,
not a DB constraint SQL Server can't express directly with the enum).

## TicketMessage
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticketId | uuid FK → Ticket | |
| authorId | uuid FK → User | |
| body | string(max ~4000) | |
| isInternalNote | boolean | true = agent-only, hidden from customer |
| createdAt | datetime | |

## TicketStatusHistory
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticketId | uuid FK → Ticket | |
| fromStatus | enum? | null on creation |
| toStatus | enum | |
| changedById | uuid FK → User | |
| changedAt | datetime | |

## KnowledgeBaseArticle
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | string | |
| body | text | |
| category | string | |
| authorId | uuid FK → User | |
| published | boolean | customers only see published=true |
| createdAt/updatedAt | datetime | |

## CustomerFeedback (P1)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticketId | uuid FK → Ticket, unique | one feedback per ticket |
| rating | int (1-5) | |
| comment | string? | |
| createdAt | datetime | |

## AuditLog (P1)
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| actorId | uuid FK → User | |
| action | string | e.g. "ticket.assign" |
| entityType/entityId | string/uuid | |
| metadata | json? | |
| createdAt | datetime | |

## Relationships summary

```
User 1---1 CustomerProfile (role=Customer only)
User 1---N Ticket (as customer)
User 1---N Ticket (as assignedAgent)
Ticket 1---N TicketMessage
Ticket 1---N TicketStatusHistory
Ticket 1---1 CustomerFeedback (P1)
User 1---N KnowledgeBaseArticle (author)
```

## SLA priority config (seeded, not user-editable in P0)

| Priority | Response SLA | Resolution SLA |
|---|---|---|
| Urgent | 30 min | 4 hours |
| High | 2 hours | 8 hours |
| Medium | 8 hours | 24 hours |
| Low | 24 hours | 72 hours |
