# Feature Spec: External Integration Adapters (P2)

**Requirement:** none formally numbered in spec.md — this is the
architectural-boundary work explicitly called for by the brief's P2
guidance ("implement clean interfaces/adapters and demonstrate the
architectural integration point where appropriate" for WhatsApp/SMS/
ERP, without real credentials).

> **Process note:** the interface design and implementation were done
> in the same pass as writing this spec, rather than the spec being
> reviewed and approved by the user first (unlike every P0/P1 feature
> and TASK-037 onward). The general shape (adapter interfaces, no real
> providers) was already explicitly approved in the original P2
> section of `spec.md`, so this is a lighter gap than the `14*` specs
> — but it's still documentation-after-code rather than
> spec-then-code. See `docs/decisions.md` for the full account.

## Goal
Show where and how a real notification provider (email/SMS/WhatsApp)
and a real ERP would plug in, without building or paying for one.

## Scope
- `NotificationChannel` interface (`send(to, subject, message)`),
  with mock (`Console*Channel`) implementations for email, SMS, and
  WhatsApp — each documents the real provider it stands in for
  (SMTP/Resend, Twilio, Meta WhatsApp Cloud API respectively).
- `notificationDispatcher.notifyCustomer(channel, to, subject,
  message, actorId)` — the one call site every route uses; writes an
  audit-log entry (`notification.sent`) so dispatch is visible in the
  existing Audit Log UI.
- `ErpClient` interface (`syncCustomer(...)`), with a `NoopErpClient`
  mock implementation.
- Two real, demonstrated call sites (not just unused code):
  - `PATCH /tickets/:id` → when status becomes Resolved/Closed, calls
    `notifyCustomer("email", ...)`.
  - `POST /customers` → after creating a customer, calls
    `erpClient.syncCustomer(...)`.

Out of scope (explicitly, per the brief): a real email/SMS/WhatsApp
provider account, a real ERP connection, a notification-preferences
UI, retry/queue infrastructure.

## Acceptance criteria
- [x] Resolving/closing a ticket triggers the mock email channel and
      writes a `notification.sent` audit entry.
- [x] Creating a customer triggers the mock ERP sync.
- [x] Neither call site can break its parent request — both are
      wrapped so a (mock, currently impossible) failure logs and
      doesn't 500 the API response.
- [x] Swapping a mock channel for a real provider requires no change
      anywhere except the one adapter file (interface-driven).

## Implementation
`backend/src/integrations/`: `notificationChannel.ts` (interface),
`channels/{email,sms,whatsapp}Channel.ts` (mocks),
`notificationDispatcher.ts` (dispatch + audit log), `erpClient.ts`
(interface + mock).

## Verification
Isolated script run confirmed both mock adapters execute cleanly
(`[erp:mock]`, `[email:mock]` console output); live server test
confirmed a real `notification.sent` audit-log entry is written when
a real ticket is resolved via the API, and customer creation returns
201 with the ERP hook active.

## Status: Done
