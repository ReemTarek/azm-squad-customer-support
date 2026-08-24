# Feature Spec: AI-Suggested KB Articles

**Requirement:** CRM-AI-004
**Related task:** TASK-032

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

An agent working a ticket gets pointed at relevant existing help
articles instead of manually searching the KB — closing the loop
between the ticket and KB systems, which previously had no connection.

## Assumptions

- Constrained-choice prompting (Gemini picks from a provided list of
  real article IDs, never invents one) is safer than open-ended
  generation — same defensive pattern needed here as for any
  AI-suggests-from-a-fixed-set feature.
- Only *published* articles are eligible — an agent shouldn't be
  pointed at a draft the customer can't actually open.
- Zero suggestions is a valid, expected outcome (not an error) when
  nothing in the KB is relevant.

## Scope

- `GET /tickets/:id/suggested-articles` (Agent/Manager/Admin only):
  sends the ticket subject + thread + a list of `{id, title,
  category}` for all published articles to Gemini, asks for a JSON
  array of up to 3 relevant IDs, validates the response against the
  known ID set before returning full article objects.
- "Suggest Articles" button in the ticket detail page's "AI Assist"
  section.

Out of scope: automatically linking suggested articles to the ticket
record, ranking/scoring relevance beyond the model's own ordering.

## Acceptance criteria

- [x] A clearly KB-answerable ticket (e.g. a login issue) returns the
      matching article (e.g. password reset).
- [x] An unrelated ticket returns an empty list, not a forced/wrong
      match.
- [x] A malformed or non-JSON model response degrades to an empty
      list rather than crashing the request.
- [x] Customer role blocked (403).

## Implementation

`backend/src/services/gemini.ts` (`suggestRelevantArticleIds`),
`backend/src/routes/tickets.ts` (`GET /:id/suggested-articles`),
`frontend/src/pages/tickets/TicketDetailPage.tsx`.

## Verification

Real Gemini API, both directions confirmed: a "Cannot login" ticket
correctly surfaced the password-reset article; an unrelated ticket
("Cannot access invoice history") correctly returned no suggestions
(screenshot: "No relevant articles found").

## Status: Done
