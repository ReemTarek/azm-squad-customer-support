# Feature Spec: New-Message Customer Notifications

**Date:** 2026-08-24
**Requirement:** CRM-NOTIFY-002 (extends CRM-NOTIFY-001, `14h-in-app-notifications.md`)
**Round:** Round 2 — Post-Test-Suite Enhancements, item 4 of 9

## Goal

Notify a customer by email when staff post a new visible reply on
their ticket. Confirmed gap (found while debugging with the user,
2026-08-24): `notifyCustomer` is called from exactly one place in the
whole backend — the resolved/closed status transition
(`tickets.ts:205`) — never on a new message. Today a customer only
learns about a reply by returning to the portal and checking.

## Assumptions

- Only **non-internal** messages trigger a notification — internal
  notes are staff-only by design (`04-ticket-management.md`) and must
  never leak to the customer via any channel, including this one.
- Only staff-authored messages trigger it — a customer's own message
  obviously shouldn't notify themselves.
- No batching in this version: each qualifying message sends one email
  immediately, reusing the exact `notifyCustomer("email", ...)` call
  already used for the resolved/closed path. If an agent posts three
  replies in a row, the customer gets three emails — a real but
  accepted limitation for this version (see Out of scope).
- Reuses the existing single real channel (email) — this feature does
  not depend on `24-real-sms-whatsapp-channels.md` being done first,
  but is written so that once SMS/WhatsApp become real, wiring them in
  here is a one-line addition to the same call site (per the
  `NotificationChannel` interface's existing design intent).

## Scope

- `backend/src/routes/tickets.ts`'s `POST /:id/messages` handler: after
  successfully creating a `TicketMessage`, if `isInternalNote === false`
  **and** the author's role is not `Customer`, call `notifyCustomer`
  with the ticket's customer email, a subject like `"New reply on your
  ticket"`, and the message body (or a truncated preview of it).
- Wrapped in the same non-fatal `.catch(...)` pattern already used at
  the resolved/closed call site — a notification failure must never
  fail the message-post request itself.

## Out of scope

- Batching/debouncing multiple rapid replies into one email (a real
  future improvement, not built now — avoids scope creep on what's
  meant to be a small, targeted fix).
- Any change to the resolved/closed notification path, which is
  unaffected and stays exactly as it is.
- SMS/WhatsApp delivery of this same event — covered automatically
  once `24-real-sms-whatsapp-channels.md` lands, per its own spec.

## Acceptance criteria

- [x] Staff posting a visible reply triggers exactly one email to the
      ticket's customer. Verified by Task 1's audit-log-based automated
      test (no real-SMTP check was performed — see Verification plan
      below).
- [x] Staff posting an internal note triggers **no** email. Verified by
      Task 1's audit-log-based automated test.
- [x] A customer posting their own message triggers no email (no
      self-notification). Verified by Task 1's audit-log-based
      automated test.
- [ ] A notification-dispatch failure (e.g. SMTP temporarily down)
      does not cause the message-post API call to fail or roll back.
      Not covered by any of Task 1's three tests — none of them
      simulate a `notifyCustomer` failure. Left unchecked: it is true
      only by construction (the identical, unmodified
      `.catch((err) => ...)` pattern already used at the resolved/closed
      call site), not by direct test evidence — the same honest
      treatment given to similar architecturally-true-but-untested
      criteria elsewhere in this project (see
      `21-staff-user-management.md`'s token-validity-until-expiry
      criterion).

## Implementation

`backend/src/routes/tickets.ts` (the `POST /:id/messages` handler
only) — no schema change, no new files.

## Verification plan

Real end-to-end check per this project's established pattern: with
real SMTP credentials configured, post a visible reply as an Agent and
confirm a real email arrives at the customer's address; post an
internal note and confirm no email is sent; post as the Customer and
confirm no email is sent to themselves.

## Status: Done

Verified via Task 1's 3 new audit-log-based automated tests (staff
visible reply → notification audit entry written; staff internal note
→ no notification; customer's own message → no notification), plus
the full 46/46 backend suite passing and a clean `tsc --noEmit` (Task
2). No real-SMTP/real-inbox check was performed for this feature — the
automated audit-log-based tests are the only evidence for the first
three acceptance criteria; the 4th remains unchecked above as it is
untested by construction only. See `docs/verification.md` and
`.superpowers/sdd/2026-08-25-new-message-notifications/task-2-report.md`.
