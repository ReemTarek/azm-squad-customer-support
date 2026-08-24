# Discussion Spec: Real Communication Providers

**Status: decided 2026-08-24.** Email → real (Gmail/Google SMTP),
credentials pending from user. SMS (Twilio) and WhatsApp (Meta Cloud
API) → approved to build, credentials pending — see "How to get each
API key" below for what the user needs to go get.

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

## How to get each API key

**Email (Gmail/Google):**
1. Go to your Google Account → Security → 2-Step Verification (must be
   ON — App Passwords require it).
2. Security → "App passwords" (search "App passwords" in the account
   settings search bar if it's not visible directly).
3. Create one for "Mail" / "Other (custom name)" → name it e.g.
   "AZM CRM" → Google gives you a 16-character password.
4. Give me: the Gmail address + that 16-character app password (not
   your normal Google password). Goes into `backend/.env` as
   `SMTP_USER`/`SMTP_PASS`, never committed to git.

**SMS (Twilio):**
1. Sign up free at twilio.com (free trial credit is enough for
   testing; trial accounts can only text verified numbers until you
   upgrade).
2. Console dashboard → copy your **Account SID** and **Auth Token**.
3. Get a trial phone number: Phone Numbers → Manage → Buy a number
   (free trial numbers are available).
4. Give me: Account SID, Auth Token, the trial phone number.

**WhatsApp (Meta Cloud API):**
1. Create a Meta Developer account at developers.facebook.com.
2. Create an app → add the "WhatsApp" product to it.
3. The app dashboard gives you a **test phone number** and a
   **temporary access token** (valid 24h — fine for dev/demo; a
   permanent token needs business verification, not needed for this
   project).
4. Add your own phone as a test recipient (WhatsApp → API Setup → "To"
   field → verify your number) — Meta's sandbox only sends to
   pre-verified numbers.
5. Give me: the temporary access token, the phone number ID (shown on
   the same page).

## Recommendation

Straightforward to add whenever credentials are available — this is
the lowest-risk of the four discussion items precisely because the
integration boundary was already built and verified in TASK-035/036.
Nothing left to decide except when each credential set arrives.

## Progress (2026-08-24)

**Email: code-complete, pending credentials.** `SmtpEmailChannel`
(nodemailer) replaces the mock in `notificationDispatcher.ts`. Reads
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` from `.env`; falls back
to console-logging (not throwing) when unconfigured, so the app works
identically before and after credentials arrive. Verified: resolving a
ticket with SMTP unconfigured still returns 200 and logs
`[email:unconfigured] ... would send to=...`; the `notification.sent`
audit-log entry is still written either way. Once a real Gmail address
+ app password are added to `backend/.env`, no code change is needed —
real emails will start sending immediately.

**SMS/WhatsApp: not yet started**, pending Twilio/Meta credentials.
