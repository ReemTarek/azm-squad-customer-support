# Feature Spec: Bootstrap Responsive Redesign

**Date:** 2026-08-24
**Requirement:** CRM-UI-002 (extends CRM-UI-001, `11-responsive-ui.md`)
**Round:** Round 2 — Post-Test-Suite Enhancements, item 1 of 9 (built first;
every later Round 2 item builds its UI on top of this)

## Goal

Replace the app's hand-rolled CSS layout (`frontend/src/App.css`,
534 lines) with Bootstrap 5, so every page is genuinely responsive,
visually richer, and consistent — without introducing a heavier
component-abstraction library or breaking the existing Arabic/English
RTL support.

## Assumptions

- Bootstrap 5 ships prebuilt RTL and LTR CSS bundles
  (`bootstrap.rtl.min.css` / `bootstrap.min.css`) — no Sass build
  pipeline is needed to get RTL support, since the app already toggles
  `dir="rtl"|"ltr"` based on the active i18n language
  (`10-i18n.md`).
- Plain Bootstrap (CSS + its bundled JS for interactive components:
  navbar collapse, dropdowns) is used directly via className, **not**
  `react-bootstrap` — the app's components are already hand-rolled
  JSX with no existing UI-component library, so adding Bootstrap
  classes to existing markup is a much smaller, lower-risk diff than
  swapping every element for a React component wrapper.
- No frontend automated tests exist that assert on CSS class names
  (confirmed: the only test suite in this repo is the backend
  integration suite, `19-backend-integration-tests.md`), so replacing
  classNames carries no test-breakage risk.
- This is a visual/layout redesign only — no new pages, no new
  business logic, no route changes.

## Scope

- Add `bootstrap` as a frontend dependency (no `react-bootstrap`).
- Conditionally load the RTL or LTR Bootstrap CSS bundle based on the
  current i18n language/direction (a small runtime `<link>`-swap or
  dynamic `import()`, decided at implementation time against
  whichever approach Vite handles more cleanly).
- Migrate page-by-page, in this order (each order step is independently
  shippable and testable in the browser before moving to the next):
  1. `Layout.tsx` (nav bar → Bootstrap `navbar` + responsive collapse;
     this wraps every page, so getting it right first benefits every
     later page)
  2. Auth pages (login/register) → Bootstrap forms
  3. List/table pages (Customers, Tickets, KB, Audit Log) → Bootstrap
     tables + responsive table wrapper + Bootstrap buttons/badges
  4. Detail pages (Ticket detail, Customer detail) → Bootstrap cards,
     grid (`row`/`col`), forms, alerts
  5. Remaining pages (Reports, SLA Settings, Org Settings, Chat,
     Quick Replies)
- Keep `frontend/src/App.css`/`index.css` for anything Bootstrap
  doesn't cover (app-specific color tokens, the SLA badge's
  color-by-state logic) — don't force everything into Bootstrap
  utility classes if a small custom rule is clearer.
- Preserve every existing `data-testid`-equivalent behavior (there are
  none currently — confirmed no frontend tests reference classNames)
  and every existing i18n string/RTL behavior exactly.

## Out of scope

- Custom branding (colors/logo) — that's `28-custom-branding.md`,
  built after this, on top of Bootstrap's CSS custom-property
  variables (Bootstrap 5's `--bs-primary` etc. make that swap-in
  straightforward later).
- Any new pages, routes, or business logic.
- A native mobile app — "mobile-friendly" here means the existing
  responsive web app, not a separate app.
- Dark mode.

## Acceptance criteria

- [x] `npm run build` (frontend) succeeds with Bootstrap installed.
- [x] Every existing page renders with no visual regression in
      functionality (all buttons/forms/links still work — verified
      via Playwright click-through, not just visual inspection).
- [x] At a narrow viewport (375px, the same width used to catch the
      original `.app-header` overflow bug in `debugging-notes.md`),
      every migrated page has no horizontal scroll and the nav
      collapses into a usable mobile menu.
- [x] RTL (Arabic) rendering is verified correct after the Bootstrap
      RTL bundle loads — mirrored layout, no broken alignment.
- [x] No console errors introduced on any page.

## Implementation

`frontend/package.json` (add `bootstrap`), a small language→CSS-bundle
loader (exact file TBD at plan time — likely `frontend/src/index.tsx`
or a new `frontend/src/lib/bootstrapLoader.ts`), and incremental edits
across every file in `frontend/src/components/` and
`frontend/src/pages/**` per the migration order above.

## Verification plan

Manual Playwright click-through of the full guaranteed demo path
(`docs/demo-walkthrough.md`) after migration, at both a desktop and a
375px mobile viewport, in both English and Arabic — screenshots taken
at each, checked for console errors, matching the verification rigor
used throughout this project (real running app, not code review).

## Status: Done
