# Feature Spec: Responsive UI

**Requirement:** CRM-UI-001
**Related task:** TASK-017

## Goal
Core screens are usable at mobile/tablet/desktop widths with no
horizontal page scroll.

## Scope
- Header/nav wraps instead of overflowing at narrow widths.
- Wide tables scroll inside their own container instead of widening
  the page.
- Checked at 375px / 768px / 1440px on dashboard, tickets, customers,
  reports.

Out of scope: a distinct mobile navigation pattern (hamburger menu),
touch-specific interactions.

## Acceptance criteria
- [x] No horizontal page overflow at any of the 3 breakpoints on any
      of the 4 checked screens.

## Implementation
- `frontend/src/App.css`: `flex-wrap` on `.app-header`/`nav`/
  `.app-header-user`, a 640px media query, `.table-scroll` wrapper
  (`overflow-x: auto`) around `.data-table`.

## Verification
`docs/verification.md`: "Responsive layout" row — PASS, 12/12
combinations (4 pages × 3 widths). One real bug found and fixed along
the way — see `docs/debugging-notes.md` (header didn't wrap, page
overflowed by 282px at mobile width before the fix).

## Status: Done
