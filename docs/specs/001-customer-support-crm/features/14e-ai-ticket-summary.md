# Feature Spec: AI Ticket Summary

**Requirement:** CRM-AI-003
**Related task:** TASK-031

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

An agent picking up a ticket can get a 2-3 sentence summary instead of
reading the full thread, especially useful for tickets with a long
history or an internal-note-heavy escalation trail.

## Assumptions

- Reuses the exact `suggestReply` pattern already built and verified
  (TASK-013): same `getModel()`/`formatThread()` helpers, same
  agent-only access, same graceful-failure-to-503 behavior — this is
  a template-following extension, not new architecture, which is part
  of why it wasn't spec'd as heavyweight as the original feature.
- Internal notes are included in the summarization context (same
  agent-only-context rule as the original suggested-reply feature) —
  never exposed to the customer since the output is agent-facing only.

## Scope

- `GET /tickets/:id/summary` (Agent/Manager/Admin only).
- "Summarize Ticket" button in the ticket detail page's "AI Assist"
  section, displays the result inline.

Out of scope: auto-summarizing on ticket open (explicit button click
only, avoiding unnecessary Gemini calls), summarizing across multiple
tickets.

## Acceptance criteria

- [x] Returns a real, coherent, contextually-accurate summary from the
      live Gemini API.
- [x] Customer role blocked (403).
- [x] A Gemini failure returns 503 `AI_UNAVAILABLE`, not a crash —
      same shared failure path as `suggestReply`.

## Implementation

`backend/src/services/gemini.ts` (`summarizeTicket`),
`backend/src/routes/tickets.ts` (`GET /:id/summary`),
`frontend/src/pages/tickets/TicketDetailPage.tsx` ("AI Assist" section).

## Verification

Real Gemini API call against a live ticket with prior messages —
summary correctly referenced the actual escalation note and reply
content. Customer role confirmed blocked (403).

## Status: Done
