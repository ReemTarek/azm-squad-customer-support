# Feature Spec: Customer Interaction History

**Requirement:** CRM-CUSTOMER-003
**Related task:** TASK-029

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

Staff viewing a customer's profile can see that customer's ticket
history without navigating away to the Tickets list and filtering
manually.

## Assumptions

- Staff-only (Admin/Manager/Agent) — a Customer viewing their own
  profile doesn't need this section since they already have a
  dedicated, unfiltered "My Tickets" view via the Tickets nav link.
- Reuses the existing `GET /tickets?customerId=` capability rather
  than a new endpoint — the filter didn't exist yet for staff roles,
  so this required a small backend addition alongside the frontend one.

## Scope

- `GET /tickets?customerId=<id>` support added for Admin/Manager/Agent
  (previously only Customer's own-record scoping used `customerId`
  implicitly; staff could not filter by an arbitrary customer).
- A "Ticket History" section on the customer detail page, staff-only,
  listing subject/status/SLA badge with links to each ticket.

Out of scope: showing KB articles viewed, login history, or other
non-ticket interactions — "interaction history" here means tickets
specifically, matching how the gap was originally framed.

## Acceptance criteria

- [x] Staff viewing a customer's profile sees that customer's tickets.
- [x] A customer with no tickets shows "No tickets yet."
- [x] Customer role never sees this section on their own profile page.

## Implementation

`backend/src/routes/tickets.ts` (`customerId` query param support for
non-Customer roles), `frontend/src/pages/customers/CustomerDetailPage.tsx`.

## Verification

Playwright: staff opens an existing customer's detail page, sees their
real ticket history rendered with links and SLA badges.

## Status: Done
