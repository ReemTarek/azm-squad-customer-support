# Discussion Spec: Real Communication Providers

**Status: not approved — blocked on credentials, not on design.**

## What was asked

Replace the mock email/SMS/WhatsApp channels (`features/13-integration-adapters.md`)
with real providers that actually deliver messages.

## Why this is different from the other three discussion items

The architecture is already done. `NotificationChannel` is an
interface; `ConsoleEmailChannel`/`ConsoleSmsChannel`/`ConsoleWhatsAppChannel`
are drop-in mocks. Swapping one for a real implementation is a single
new file plus a registry-line change in `notificationDispatcher.ts` —
no caller changes, no design work. This item is blocked purely on
**you providing credentials**, not on any remaining design decision.

## What's needed per channel, if you want to proceed

- **Email** (easiest): an SMTP account (Gmail app password) or a
  free-tier transactional API (Resend, Brevo) — one API key/app
  password.
- **SMS**: a Twilio account — account SID + auth token + a phone
  number.
- **WhatsApp**: a Meta Developer account + WhatsApp Business API app
  on the free sandbox tier — a temporary access token + test phone
  number ID.

## Draft implementation per channel (once credentials exist)

- Email: `nodemailer` + SMTP, or a fetch call to the provider's REST
  API — implements `NotificationChannel.send()`.
- SMS: Twilio SDK call — implements `NotificationChannel.send()`.
- WhatsApp: fetch call to the Cloud API's `/messages` endpoint —
  implements `NotificationChannel.send()`.

## Recommendation

Straightforward to add whenever credentials are available — this is
the lowest-risk of the four discussion items precisely because the
integration boundary was already built and verified in TASK-035/036.
Nothing to decide here except whether/when you'll provide credentials.
