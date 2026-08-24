# Feature Spec: Real SMS (Twilio) & WhatsApp (Meta Cloud API) Channels

**Date:** 2026-08-24
**Requirement:** CRM-INTEGRATION-003 (extends CRM-INTEGRATION-001/002)
**Round:** Round 2 — Post-Test-Suite Enhancements, item 5 of 9
**Status: blocked on credentials** — this spec is written and ready so
implementation can start the moment credentials arrive; see
`discussion-real-communication-providers.md` for how to obtain them
(Twilio Account SID/Auth Token/phone number; Meta Developer WhatsApp
Cloud API access token + phone number ID).

## Goal

Replace the two mock channels (`ConsoleSmsChannel`, `ConsoleWhatsAppChannel`
— pure `console.log`, confirmed no real provider code anywhere in the
repo) with real Twilio SMS and Meta WhatsApp Cloud API implementations
of the same `NotificationChannel` interface, and wire them into the
existing notification trigger points (resolved/closed,
`23-new-message-notifications.md`) so a customer with a phone number on
file gets a real text/WhatsApp message, not just email.

## Assumptions

- `CustomerProfile` needs a phone number field to notify against — this
  spec assumes one already exists or can be added trivially; confirm
  the exact field name in `schema.prisma` at implementation time before
  writing the channel classes (don't guess the column name).
- **No customer-facing channel-preference UI in this version** —
  automatically attempt SMS/WhatsApp in addition to email whenever
  (a) the customer has a phone number on file, and (b) the
  corresponding env vars are configured. If either condition is false,
  behavior is unchanged (email only, exactly as today). This keeps the
  feature "just works" once credentials exist, with zero new UI.
- Each channel fails independently and non-fatally — if Twilio errors,
  email still sends; if WhatsApp errors, SMS/email still send. Mirrors
  the existing per-channel `.catch(...)` pattern.
- WhatsApp's sandbox/free tier only delivers to pre-verified recipient
  numbers until Meta business verification is complete — a real
  constraint to test against, not a bug if a non-verified number
  doesn't receive a message during initial testing.

## Scope

- `npm install twilio` in `backend/`.
- New env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`, `META_WHATSAPP_ACCESS_TOKEN`,
  `META_WHATSAPP_PHONE_NUMBER_ID` — added to `backend/src/config/env.ts`
  and `.env.example`, following the exact same optional/fallback
  pattern already used for `SMTP_*` (blank → falls back to the mock
  console-log behavior, never throws).
- New `backend/src/integrations/channels/twilioSmsChannel.ts` and
  `metaWhatsAppChannel.ts`, each implementing `NotificationChannel`,
  swapped into `notificationDispatcher.ts`'s registry in place of the
  console mocks — no other file changes needed, per the dispatcher's
  own stated design intent (`notificationDispatcher.ts:13-16`).
- Extend the two existing `notifyCustomer` call sites
  (resolved/closed in `tickets.ts`, and the new-message one in
  `23-new-message-notifications.md`) to also attempt `"sms"` and
  `"whatsapp"` when the customer has a phone number, alongside the
  existing `"email"` call.

## Out of scope

- A customer-facing UI to choose/opt out of specific channels (a real
  follow-up, not built now).
- Two-way SMS/WhatsApp (customer replying via text back into the
  ticket) — this spec is outbound-notification only, matching the
  existing email channel's scope.
- Any channel other than these two plus the existing email.

## Acceptance criteria

- [ ] With real Twilio credentials configured, resolving a ticket for
      a customer with a phone number sends a real SMS.
- [ ] With real Meta credentials configured, the same triggers a real
      WhatsApp message (to a pre-verified sandbox recipient during
      testing).
- [ ] With credentials blank (today's default), behavior is
      byte-for-byte identical to before this feature — email only,
      no errors, no regression.
- [ ] A Twilio-specific failure (e.g. invalid number) doesn't prevent
      the email or WhatsApp attempt from still going through.

## Implementation

`backend/src/config/env.ts`, `.env.example`; new channel files under
`backend/src/integrations/channels/`; `notificationDispatcher.ts`
(registry swap); `tickets.ts` (extend both notify call sites).

## Verification plan

Cannot be verified until credentials are supplied — when they are,
verify each channel independently (real SMS received, real WhatsApp
message received, both against a real phone number), then verify the
graceful-fallback behavior with each credential set individually
blanked out again.

## Status: Not Started (blocked — pending Twilio and Meta credentials from the user)
