# Feature Spec: AI Usage Dashboard

**Date:** 2026-08-24
**Requirement:** CRM-AI-007
**Round:** Round 2 — Post-Test-Suite Enhancements, item 8 of 9

## Goal

A reporting view showing how much the AI features are actually used
and trusted — suggestion acceptance rate, chatbot confident-vs-fallback
rate, summarization volume — none of which is tracked anywhere today
(confirmed: no `AiUsageEvent`-equivalent table, no usage/acceptance
tracking of any kind exists in the repo). This is a **new** ask, not a
previously-scoped requirement that was skipped — the original spec
never asked for AI usage analytics, only for the AI features
themselves.

## Assumptions

- Needs a new lightweight event-log table, written to at each AI call
  site — this is new instrumentation, not a repurposing of the
  existing generic `AuditLog` (which logs security-relevant actions
  like `notification.sent`, not AI-specific outcomes like "was this
  suggestion accepted").
- "Accepted" is only meaningfully knowable for **suggested replies**
  (the agent can edit/discard the draft before sending — knowing
  whether they used it as-is, edited it, or ignored it requires the
  frontend to tell the backend which happened) and **suggested KB
  articles** (did the agent click through to one). Ticket summaries
  have no accept/reject action (an agent just reads it) — for those,
  only *volume* (how many times summarization was requested) is
  tracked, not acceptance.
- Reuses the existing Reports page's layout/chart patterns
  (`ReportsPage.tsx`, `backend/src/routes/reports.ts`'s
  `/summary`/`/trends` structure) rather than inventing a new visual
  language — a new tab/section on the same page, not a wholly separate
  page with different conventions.

## Scope

- **Schema:** new `AiUsageEvent` model — `id`, `eventType`
  (`suggest_reply_shown`|`suggest_reply_used`|`summary_requested`|
  `suggested_articles_shown`|`suggested_article_clicked`|
  `chatbot_confident`|`chatbot_fallback`), `ticketId` (nullable, for
  ticket-scoped events), `userId`, `createdAt`.
- **Backend:** write one `AiUsageEvent` row at each existing AI call
  site (`suggestReply`, `summarizeTicket`, `suggestRelevantArticleIds`,
  `answerFromKnowledgeBase` in `gemini.ts` and their route handlers in
  `tickets.ts`/`chat.ts`) — recording the call itself
  (`*_shown`/`*_requested`/`chatbot_confident`/`chatbot_fallback`).
  The frontend separately calls a small new endpoint
  (`POST /api/reports/ai-usage/event`) to record `suggest_reply_used`
  (when an agent actually sends the AI-drafted reply, possibly edited)
  and `suggested_article_clicked` (when an agent clicks through to a
  suggested article) — these are user actions the backend can't see on
  its own.
- New `GET /api/reports/ai-usage` (Admin/Manager, matching the existing
  Reports route's role gate) returning: suggested-reply
  shown-vs-used count and rate, suggested-articles shown-vs-clicked
  count and rate, summary-request volume, chatbot confident-vs-fallback
  count and rate — as an all-time aggregate.
  **Correction (2026-08-26, caught during plan self-review):** the
  original wording claimed this would reuse "the same optional date
  range already supported by `/reports/trends`" — that support doesn't
  exist. Reading the real current `backend/src/routes/reports.ts`
  confirms `/trends` hardcodes a rolling 7-day window internally for
  one field (`ticketsCreatedPerDay`) and accepts no `from`/`to` query
  params; no endpoint in this file has date-range filtering. There is
  no established convention to reuse. Since no acceptance criterion
  below actually requires date filtering, this ships as an all-time
  aggregate instead — consistent with `/summary`'s existing behavior
  (also unfiltered), which is the closer analog for an aggregate-style
  report anyway. Date-range filtering is a reasonable future add-on,
  not a regression from this correction.
- **Frontend:** a new "AI Usage" section/tab on the existing
  `ReportsPage.tsx`.

## Out of scope

- Per-agent AI-usage breakdown (org-wide aggregate only, for this
  version — matches the effort level of the rest of Round 2's smaller
  items; a per-agent view is a reasonable future add-on).
- Cost/token-usage tracking (Gemini billing metrics) — this is about
  feature usage/trust, not API cost accounting.
- Any change to the AI features' own behavior — this is purely
  additive instrumentation and a read-only report.

## Acceptance criteria

- [ ] Every `suggestReply`/`summarizeTicket`/`suggestRelevantArticleIds`/
      `answerFromKnowledgeBase` call writes exactly one corresponding
      `AiUsageEvent` row.
- [ ] Sending an AI-drafted reply (edited or not) records a
      `suggest_reply_used` event; discarding it without sending
      records nothing further beyond the original `_shown` event.
- [ ] The new report endpoint returns accurate counts/rates verified
      by direct comparison against a manual Prisma query, matching this
      project's established reporting-verification standard
      (`14d-csat-agent-performance-reports.md`).
- [ ] The AI Usage report is visible only to Admin/Manager, matching
      the existing Reports page's access control.

## Implementation

New migration (`AiUsageEvent`); `backend/src/services/gemini.ts`
callers instrumented at each call site in `tickets.ts`/`chat.ts`;
new `backend/src/routes/reports.ts` endpoint (or a small new
`aiUsageReports.ts` route, decided at plan time based on how large
`reports.ts` has already grown); `frontend/src/pages/ReportsPage.tsx`
(new section); `frontend/src/lib/reportsApi.ts` (extend).

## Verification plan

Trigger each AI feature a known number of times, verify the report's
counts match exactly via a manual Prisma query cross-check — the same
rigor already used to verify the existing CSAT/agent-performance
reports.

**Correction (2026-08-26, caught during plan self-review):** this
project's test environment intentionally leaves `GEMINI_API_KEY`
unconfigured (established in two prior Round 2 features), so
`suggestReply`/`summarizeTicket`/`suggestRelevantArticleIds` always
throw in automated tests, and their three route handlers
(`/:id/suggest-reply`, `/:id/summary`, `/:id/suggested-articles`)
already convert that into `Errors.aiUnavailable()` — the whole request
fails before an `AiUsageEvent` write is ever reached. This means the
"shown"/"requested" event writes for those three routes cannot be
exercised end-to-end via an automated HTTP test in this environment,
the same limitation the two prior AI-touching Round 2 features hit.
The plan verifies this differently: (a) the *aggregation* logic in
`GET /api/reports/ai-usage` is fully and rigorously tested by seeding
`AiUsageEvent` rows directly (bypassing the instrumented call sites,
which is fine — the report's job is to aggregate whatever rows exist,
independent of how they got there) and cross-checking against a manual
Prisma query, satisfying this criterion's letter exactly; (b) the
negative property — a failed Gemini call writes **no** event — is
automated-tested for all three ticket-AI routes, since Gemini failure
is the deterministic path in this environment; (c) the chatbot path
(`answerFromKnowledgeBase` in `chat.ts`) already degrades to a fallback
response rather than an error even when Gemini is unconfigured, so its
event-write (`chatbot_fallback`) *is* fully automated-testable
end-to-end; (d) the three ticket-route "on success, writes exactly one
event" claims are verified by direct code reading (the write sits
immediately after the Gemini call succeeds, structurally symmetric
with the already-tested chatbot path) plus an optional manual
real-Gemini check if credentials are available in the environment,
documented honestly either way — matching this project's established
convention for this exact class of gap.

## Status: Not Started
