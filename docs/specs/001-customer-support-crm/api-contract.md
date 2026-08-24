# API Contract

Base path: `/api`. All responses JSON. Errors: `{ "error": { "code", "message", "details"? } }`.
Auth: `Authorization: Bearer <accessToken>` unless noted public.

## Auth
| Method | Path | Roles | Body → Response |
|---|---|---|---|
| POST | /auth/register | public | `{email,password,name,role?}` → `{user,accessToken,refreshToken}` (role defaults to Customer; only Admin can create Agent/Manager/Admin via /users) |
| POST | /auth/login | public | `{email,password}` → `{user,accessToken,refreshToken}` |
| POST | /auth/refresh | public (valid refresh token) | `{refreshToken}` → `{accessToken,refreshToken}` |

## Users (Admin)
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /users | Admin,Manager | list, filter by role |
| POST | /users | Admin | create Agent/Manager/Admin account |
| GET | /users/:id | Admin,Manager | |
| PATCH | /users/:id | Admin | update role/active state |

## Customers
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /customers | Admin,Manager,Agent | list/search |
| POST | /customers | Admin,Agent | creates User(role=Customer)+CustomerProfile |
| GET | /customers/:id | Admin,Manager,Agent, self (Customer) | |
| PATCH | /customers/:id | Admin,Agent, self (Customer) | |

## Tickets
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /tickets | Customer,Agent,Admin | Customer can only create for self |
| GET | /tickets | Admin,Manager,Agent (scoped: assigned to me by default),Customer (scoped: own only) | query: status,priority,assignedAgentId |
| GET | /tickets/:id | Admin,Manager,Agent,Customer(owner) | 403 if Customer requests another customer's ticket |
| PATCH | /tickets/:id | Admin,Manager,Agent(assigned) | status/priority changes → writes TicketStatusHistory |
| POST | /tickets/:id/assign | Admin,Manager | `{agentId}` |
| POST | /tickets/:id/messages | Admin,Manager,Agent,Customer(owner) | `{body,isInternalNote?}` — isInternalNote forced false for Customer |
| GET | /tickets/:id/messages | same as GET ticket | Customer never sees isInternalNote=true rows |
| POST | /tickets/:id/suggest-reply | Admin,Manager,Agent | Gemini-assisted; 503 if GEMINI_API_KEY unset |
| GET | /tickets/:id/history | Admin,Manager,Agent,Customer(owner) | status history |

## Knowledge Base
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /kb | all authenticated | Customer sees published=true only |
| GET | /kb/:id | all authenticated | same rule |
| POST | /kb | Admin,Agent | |
| PATCH | /kb/:id | Admin,Agent(author) | |

## Feedback (P1)
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /tickets/:id/feedback | Customer(owner) | only when status=Resolved/Closed |

## Reports
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | /reports/summary | Admin,Manager | counts by status/priority, avg resolution time, tickets per agent |

## Validation error example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "field": "priority", "message": "must be one of Low,Medium,High,Urgent" }]
  }
}
```

## Standard error codes

`UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`VALIDATION_ERROR` (400), `CONFLICT` (409, e.g. duplicate email),
`AI_UNAVAILABLE` (503, Gemini disabled/erroring).
