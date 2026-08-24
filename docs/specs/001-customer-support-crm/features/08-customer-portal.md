# Feature Spec: Customer-Facing Portal

**Requirement:** CRM-PORTAL-001
**Related task:** TASK-014
**Depends on:** 03-customer-management (login), 04-ticket-management, 06-knowledge-base

## Goal
One cohesive path for a Customer: submit a ticket, track it, reply,
and browse help articles — without ever seeing another customer's
data, staff-only controls, or internal notes.

## Scope
This is a composition feature, not new code: the same
role-scoped ticket and KB screens already satisfy it once RBAC and
ownership are correct. The spec here is about the *end-to-end path*
being cohesive, not about introducing customer-only UI variants.

Out of scope: a dedicated "customer portal" visual theme, a separate
subdomain/app shell.

## Acceptance criteria
- [x] Nav shows only Tickets + Knowledge Base for a Customer (no
      Customers/Reports links).
- [x] Self-register → submit a ticket → reply on it → browse KB, all
      in one session, no errors.
- [x] Cannot see other customers' tickets or agent-only internal notes
      anywhere in the flow.

## Implementation
No new backend routes. Frontend composition: `Layout.tsx` (role-gated
nav) + the ticket/KB pages from features 04 and 06.

## Verification
Verified via a single continuous Playwright run: register → nav check
→ create ticket → reply → browse KB, zero console errors. See
`docs/verification.md`.

## Status: Done
