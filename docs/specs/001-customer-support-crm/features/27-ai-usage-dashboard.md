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
  count and rate — over the same optional date range already supported
  by `/reports/trends`.
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

## Status: Not Started
