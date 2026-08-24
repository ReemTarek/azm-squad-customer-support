# Feature Spec: Knowledge Base Search

**Requirement:** CRM-KB-002
**Related task:** TASK-027

> **Process note:** written after implementation, not before. This
> and the other `14*` specs were built directly from the
> `gap-analysis.md` recommendation list once the user approved the
> "small high-value fixes" bucket as a whole — not spec'd
> individually and user-approved per item first, unlike every P0/P1
> feature and TASK-037 onward. See
> `docs/specs/001-customer-support-crm/decisions.md` for why this
> happened and what changed afterward.

## Goal

A KB article search box, matching the search capability the
Customers list already had (`gap-analysis.md` flagged this asymmetry
as a real gap — Knowledge Base had none).

## Assumptions

- Simple substring match (title/body/category) is sufficient; no
  ranking/relevance scoring needed at this data scale.
- Search must still respect the existing publish-gating (a Customer's
  search never surfaces an unpublished article) — this is an
  extension of existing access control, not a new boundary.

## Scope

- `GET /kb?search=<term>` — case-insensitive `contains` match across
  `title`, `body`, `category`, combined with the existing
  `published`-gating for Customer role.
- Search input on the KB list page.

Out of scope: full-text ranking, fuzzy match, search analytics.

## Acceptance criteria

- [x] Searching returns only matching articles.
- [x] A search with no matches returns an empty list, not an error.
- [x] Customer role never receives an unpublished article via search,
      even if the term matches it.

## Implementation

`backend/src/routes/kb.ts` (`GET /`), `frontend/src/pages/kb/KbListPage.tsx`.

## Verification

curl: search for "password" returns the seeded password-reset article;
an unmatched term returns `[]`. Playwright: typing in the search box
filters the list live; an unmatched term shows "No articles found."

## Status: Done
