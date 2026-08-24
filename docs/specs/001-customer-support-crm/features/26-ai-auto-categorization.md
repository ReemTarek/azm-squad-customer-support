# Feature Spec: AI Automatic Ticket Categorization

**Date:** 2026-08-24
**Requirement:** CRM-AI-006 (extends CRM-AI-001/003/004)
**Round:** Round 2 — Post-Test-Suite Enhancements, item 7 of 9

## Goal

Have Gemini suggest a ticket's category at creation time, so customers
(who rarely pick the "right" category themselves) don't leave every
ticket as the default `"General"`.

## Assumptions

- `Ticket.category` is a **free-text string** (`schema.prisma:88`,
  `@default("General")`), not a closed enum — confirmed by reading the
  actual schema and validation (`tickets.schema.ts` only requires
  `z.string().min(1)`). The frontend's ticket form only *suggests*
  four values via an HTML `<datalist>` (`General`, `Billing`,
  `Technical`, `Account` — `TicketFormPage.tsx:82-85`), but a customer
  can type anything.
- Because there's no closed enum, this can't use the same
  "validate the model's output against a real ID list" guard used for
  `suggestRelevantArticleIds`. Instead: query the **distinct category
  values already in use** across existing tickets at call time, and
  constrain the prompt to pick from that list (falling back to
  `"General"` if none exist yet, e.g. a brand-new deployment with zero
  tickets) — this grounds the model in real, currently-used categories
  rather than letting it invent an arbitrary new one, the same
  anti-hallucination principle used everywhere else Gemini touches
  this app (`gemini.ts`'s existing guardrail comments).
- Runs automatically on ticket creation, as a **non-blocking, best-
  effort enrichment** — if Gemini is unavailable (e.g. the free-tier
  quota, as hit during this session's own debugging) or errors, the
  ticket still creates successfully with whatever category the
  customer already provided (default `"General"` if none). This
  mirrors the existing error-handling pattern for every other
  Gemini-touching endpoint in this app (try/catch → `Errors.aiUnavailable()`
  for on-demand calls, but here it must degrade silently since ticket
  creation itself must never fail because of an AI call).
- Only applies when the customer didn't already pick a specific,
  meaningful category — if a category was explicitly provided (i.e.
  not left at the default `"General"`), respect it and skip the AI
  call entirely (don't override an explicit customer choice).

## Scope

- `backend/src/services/gemini.ts`: new `suggestTicketCategory(subject,
  messageBody, existingCategories: string[]): Promise<string>` —
  same constrained-output prompting style as `suggestRelevantArticleIds`
  (ask for exactly one value from the given list, or `"General"`).
- `backend/src/routes/tickets.ts`'s `POST /` handler: after creating a
  ticket whose `category` is still the default `"General"`, fetch
  `SELECT DISTINCT category FROM Ticket` (via Prisma `findMany` +
  `distinct`), call `suggestTicketCategory`, and update the ticket's
  category if the model returns something other than `"General"`.
  Wrapped in try/catch — any failure just leaves the category as
  `"General"`, logged but not surfaced to the customer.

## Out of scope

- Re-categorizing existing tickets in bulk (only new tickets going
  forward).
- Letting the AI invent a brand-new category never seen before (by
  design — grounded only in what's already in use, or `"General"`).
- Any UI change — the category still displays exactly as it does
  today; the difference is only which value ends up there.

## Acceptance criteria

- [ ] A customer submitting a ticket with no explicit category (or
      leaving the default) ends up with a real, sensible category
      picked from existing values in the system, when Gemini succeeds.
- [ ] A customer who explicitly picks "Billing" (or any non-default
      value) keeps that exact value — no AI override.
- [ ] If Gemini is unavailable, ticket creation still succeeds and the
      category stays `"General"` — no error surfaced to the customer.
- [ ] The AI never assigns a category that didn't already exist
      somewhere in the system (or `"General"`) at the time of the call.

## Implementation

`backend/src/services/gemini.ts` (new function);
`backend/src/routes/tickets.ts` (`POST /` handler only).

## Verification plan

Real end-to-end check: seed a few tickets with distinct real
categories, submit a new ticket with an ambiguous subject/message and
no explicit category, confirm Gemini picks one of the existing values;
separately confirm an explicit category submission is never
overridden; separately confirm ticket creation still succeeds with
Gemini's key temporarily invalid (simulating unavailability).

## Status: Not Started
