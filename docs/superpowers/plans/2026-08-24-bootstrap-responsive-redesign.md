# Bootstrap Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-24

**Goal:** Replace `frontend/src/App.css`'s hand-rolled layout CSS with
Bootstrap 5 across every existing page, so the app is genuinely
responsive and visually richer, without breaking Arabic/English RTL
support or introducing `react-bootstrap`.

**Architecture:** Install plain `bootstrap` (CSS + bundled JS), load
the LTR or RTL prebuilt CSS bundle dynamically via a `<link>` tag whose
`href` is switched inside the existing `applyDirection()` i18n hook
(`frontend/src/i18n/index.ts`) — no new direction-toggle mechanism.
Migrate page-by-page: shared nav shell first, then each page group,
applying Bootstrap's standard component classes (`navbar`, `card`,
`table`, `form-control`, `list-group`, `badge`, `alert`, `btn`) in
place of the custom classes in `App.css`. Keep a small amount of
custom CSS only where Bootstrap has no equivalent (the hand-rolled
trend bar chart, `white-space: pre-wrap` on KB article bodies).

**Tech Stack:** Bootstrap 5 (`bootstrap` npm package — CSS + bundled
JS only, no `react-bootstrap`), existing React 19 + Vite + i18next
stack, no new state-management or routing changes.

**Spec:** `docs/specs/001-customer-support-crm/features/20-bootstrap-responsive-redesign.md`

## Global Constraints

- No `react-bootstrap` or any other component-abstraction library —
  plain Bootstrap classes on existing JSX only.
- Every existing i18n string, RTL behavior, and interactive behavior
  (button clicks, form submits, links) must work identically after
  migration — this is a visual/layout change, not a behavior change.
- `frontend/src/App.css`/`index.css` are trimmed as classes are
  replaced, not deleted wholesale — remove a rule only once nothing
  references it anymore, keep the rules noted as "keep" in the Style
  Guide below.
- No new routes, no new pages, no new business logic.
- Verify every migrated page in the browser (Playwright) at both a
  desktop width and 375px, in both English and Arabic, before
  committing that task.

## Bootstrap Migration Style Guide

This mapping is the "exact values" every task below applies. Read the
**real, current** content of each file before editing it — this guide
tells you which Bootstrap classes replace which custom classes; it
does not replace reading the file.

| Custom class (in `App.css`) | Bootstrap replacement | Notes |
|---|---|---|
| `.auth-page` | `min-vh-100 d-flex align-items-center justify-content-center bg-light` | |
| `.auth-form` | `card p-4 shadow-sm` | Keep a small custom rule for its fixed width: `.auth-form { width: 320px; }` — Bootstrap has no "320px" utility. |
| `.auth-form label`, `.entity-form label`, `.ticket-controls label` (label wrapping input) | Restructure to Bootstrap's real form pattern: `<div className="mb-3"><label className="form-label">Text</label><input className="form-control" .../></div>` | This is a structural change (label and input become siblings, not nested) — apply it everywhere a label currently wraps its input. |
| `.form-error` | `alert alert-danger` (keep existing `role="alert"`) | |
| `.form-hint` | `form-text text-muted` | |
| `.form-success` | `alert alert-success` | |
| `.page-loading` | `d-flex align-items-center justify-content-center vh-100` | |
| `.app-header` / nav (Layout.tsx) | Bootstrap `navbar navbar-expand-lg navbar-light bg-white border-bottom` | Full rewrite — see Task 2. |
| `.nav-link-with-badge` / `.notification-badge` | `nav-link` on the `<Link>`; badge → `badge bg-danger rounded-pill ms-1` | |
| `.language-switcher` | `form-select form-select-sm` | |
| `.auth-language-switcher` | `position-absolute top-0 end-0 m-3` | `end-0` is a logical property — mirrors correctly in RTL automatically. |
| `.page-header` | `d-flex justify-content-between align-items-center mb-3` | |
| `.button-link` | `btn btn-primary` | |
| `.search-input` | `form-control mb-3` + `style={{ maxWidth: 280 }}` | |
| `.table-scroll` + `.data-table` | Wrap `<table>` in `<div className="table-responsive">`; table itself gets `table table-striped table-hover align-middle` | |
| `.entity-form` | Same `mb-3`/`form-label`/`form-control` pattern as `.auth-form` | |
| `.entity-form--inline` | `d-flex gap-2 align-items-end flex-wrap` on the form, each field keeps its own `mb-0` | |
| `.filters` | `d-flex flex-wrap gap-2 mb-3`; each `<select>` → `form-select form-select-sm` + `style={{ width: "auto" }}` | |
| `.sla-badge` + `--on_track`/`--at_risk`/`--breached` | `badge` + `bg-success` / `bg-warning text-dark` / `bg-danger` respectively | |
| `.ticket-meta` | `d-flex flex-wrap gap-4 text-secondary mb-3` | |
| `.ticket-controls` | `d-flex flex-wrap gap-4 p-3 bg-light rounded mb-4` | |
| `.ticket-detail section` | `mt-4` on each; wrap each section's content in `card card-body` for visual grouping | |
| `.message-thread` / `.message` / `.message--internal` | `<ul className="list-group mb-3">`, `<li className="list-group-item">`, internal → `list-group-item-warning` (Bootstrap's built-in contextual list-group variant) | |
| `.internal-tag` | `badge bg-warning text-dark mb-1` | |
| `.checkbox-label` (a checkbox + its label) | Bootstrap's real check pattern: `<div className="form-check"><input className="form-check-input" type="checkbox" .../><label className="form-check-label">Text</label></div>` | Restructure, same reasoning as the label/input pattern above. |
| `.task-list` / `.task-item` | `list-group` / `list-group-item d-flex align-items-center gap-2` | |
| `.task-item--done label` | `text-decoration-line-through text-muted` | |
| `.task-due` | `badge text-bg-warning` | |
| `.history-list` | `list-group list-group-flush small text-secondary` | |
| `.kb-list` / `.kb-list li` | `list-group mb-3` / `list-group-item d-flex align-items-center gap-2` | |
| `.kb-category` | `text-muted small` | |
| `.kb-draft-tag` | `badge bg-warning text-dark` | |
| `.quick-replies-list li` | `list-group-item d-flex justify-content-between align-items-start` | |
| `.ai-assist-row` | `d-flex flex-wrap gap-2 mb-2` | |
| `.ai-assist-result` | `card card-body bg-light mb-3` | |
| `.reply-toolbar` | `d-flex align-items-center gap-2 mb-2` | |
| `.reply-toolbar select` | `form-select form-select-sm` + `style={{ width: "auto" }}` | |
| `.secondary-button` | `btn btn-outline-primary` | |
| `.report-grid` | Bootstrap grid: `row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3` | |
| `.report-card` | `<div className="col"><div className="card h-100"><div className="card-body">` | |
| `.report-stat` | `display-6 fw-bold mb-0` | |
| `.trend-card` | `card card-body mt-3` (wrap the existing custom bar-chart markup — the bars themselves have no Bootstrap equivalent) | |
| `.trend-bars` / `.trend-bar-col` / `.trend-bar` / `.trend-bar-label` / `.trend-bar-count` | **Keep as custom CSS** — no Bootstrap chart component exists; these rules stay in `App.css` unchanged. | |
| `.kb-body` | Drop the custom rule's `max-width`/`line-height`; keep only `white-space: pre-wrap` as a small custom rule; apply `lh-lg` Bootstrap utility for line-height | |
| `.dashboard-shell header` / `.dashboard-shell main` | **Dead CSS — delete outright.** Confirmed via grep: no component anywhere renders a `.dashboard-shell` element; `DashboardShellPage.tsx` is just `<div className="page"><h1>...</h1><p>...</p></div>` and needs no markup change (it already inherits `container-fluid px-3 px-md-4 py-4` spacing from Task 2's `<main>` wrapper in `Layout.tsx`). | |
| `.page` (used as the outer wrapper on every single page) | **No-op today — confirmed no `.page` rule exists in `App.css` at all.** Leave every page's `className="page"` exactly as-is; it does nothing and isn't part of this migration. All real per-page spacing already comes from `Layout.tsx`'s `<main>` (Task 2). | |

---

### Task 1: Install Bootstrap and wire up the RTL/LTR CSS loader

**Files:**
- Modify: `frontend/package.json` (add `bootstrap` dependency)
- Modify: `frontend/src/i18n/index.ts`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: a `<link id="bootstrap-css">` element in `<head>`,
  correctly switched between the LTR and RTL Bootstrap bundle every
  time `applyDirection()` runs (called on init and on every
  `setLocale()` call) — every later task's pages rely on Bootstrap's
  CSS classes actually being loaded and mirrored correctly in RTL.

- [ ] **Step 1: Install Bootstrap**

Run: `cd frontend && npm install bootstrap`

- [ ] **Step 2: Add the LTR/RTL bundle URLs and the link-swap logic to `frontend/src/i18n/index.ts`**

Replace the file's content with:

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import bootstrapLtrUrl from "bootstrap/dist/css/bootstrap.min.css?url";
import bootstrapRtlUrl from "bootstrap/dist/css/bootstrap.rtl.min.css?url";

const STORAGE_KEY = "azm_crm_locale";
const BOOTSTRAP_LINK_ID = "bootstrap-css";

export type SupportedLocale = "en" | "ar";

export function getStoredLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

function applyBootstrapBundle(locale: SupportedLocale) {
  let link = document.getElementById(BOOTSTRAP_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = BOOTSTRAP_LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = locale === "ar" ? bootstrapRtlUrl : bootstrapLtrUrl;
}

export function applyDirection(locale: SupportedLocale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  applyBootstrapBundle(locale);
}

export function setLocale(locale: SupportedLocale) {
  localStorage.setItem(STORAGE_KEY, locale);
  i18n.changeLanguage(locale);
  applyDirection(locale);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: getStoredLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

applyDirection(getStoredLocale());

export default i18n;
```

The `?url` suffix on both Bootstrap CSS imports is load-bearing: it
tells Vite to return the built asset's URL as a string instead of
auto-injecting the CSS immediately, so the app controls exactly one of
the two bundles being active via the manually managed `<link>` tag.

- [ ] **Step 3: Import Bootstrap's bundled JS once, in `frontend/src/main.tsx`**

Add this import near the top of `frontend/src/main.tsx` (alongside the
existing `import './index.css'` and `import './i18n'` lines):

```typescript
import "bootstrap/dist/js/bootstrap.bundle.min.js";
```

This is direction-independent (it's just JS behavior for
navbar-toggler/dropdowns/collapse) and only needs loading once, unlike
the CSS.

- [ ] **Step 4: Verify in the browser**

Run `npm run dev` (frontend) and `npm run dev` (backend, if not
already running), open the app, log in. Confirm:
- Bootstrap's default font/spacing is visibly applied somewhere (even
  before any page is migrated, e.g. default link/button styling looks
  different from before).
- Switching the language selector to Arabic swaps `<html dir>` to
  `rtl` **and** the loaded `<link id="bootstrap-css">`'s `href`
  changes to the `.rtl.min.css` file (check via browser dev tools).
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/i18n/index.ts frontend/src/main.tsx
git commit -m "build: install Bootstrap 5 with RTL-aware CSS loading"
```

---

### Task 2: Migrate the shared nav shell (`Layout.tsx`)

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/components/LanguageSwitcher.tsx`
- Modify: `frontend/src/App.css` (remove now-unused `.app-header*`, `.nav-link-with-badge`, `.notification-badge`, `.app-header-user`, `.language-switcher` rules; keep `.app-main`'s content untouched for now — Task 6 may still reference it, verify before removing)

**Interfaces:**
- Consumes: the Bootstrap CSS/JS wired up in Task 1.
- Produces: the nav shell every other page renders inside
  (`<Outlet/>` inside `<main>`) — later tasks only touch each page's
  own content, not this shell.

- [ ] **Step 1: Rewrite `frontend/src/components/Layout.tsx`**

```tsx
import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getNotificationsSummary } from "../lib/notificationsApi";

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const notificationsQuery = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: getNotificationsSummary,
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  if (!user) return null;

  const alertCount = (notificationsQuery.data?.breachedCount ?? 0) + (notificationsQuery.data?.atRiskCount ?? 0);

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom px-3">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand fw-bold">{t("nav.brand")}</Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#main-nav-collapse"
            aria-controls="main-nav-collapse"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="main-nav-collapse">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-1">
              {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
                <li className="nav-item"><Link to="/customers" className="nav-link">{t("nav.customers")}</Link></li>
              )}
              <li className="nav-item">
                <Link to="/tickets" className="nav-link">
                  {t("nav.tickets")}
                  {alertCount > 0 && (
                    <span
                      className="badge bg-danger rounded-pill ms-1"
                      title={`${notificationsQuery.data?.breachedCount ?? 0} breached, ${notificationsQuery.data?.atRiskCount ?? 0} at risk`}
                    >
                      {alertCount}
                    </span>
                  )}
                </Link>
              </li>
              <li className="nav-item"><Link to="/kb" className="nav-link">{t("nav.kb")}</Link></li>
              {user.role === "Customer" && (
                <li className="nav-item"><Link to="/chat" className="nav-link">Ask a Question</Link></li>
              )}
              {(user.role === "Admin" || user.role === "Manager" || user.role === "Agent") && (
                <li className="nav-item"><Link to="/quick-replies" className="nav-link">Quick Replies</Link></li>
              )}
              {(user.role === "Admin" || user.role === "Manager") && (
                <li className="nav-item"><Link to="/reports" className="nav-link">{t("nav.reports")}</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/audit-log" className="nav-link">Audit Log</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/sla-settings" className="nav-link">SLA Settings</Link></li>
              )}
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/org-settings" className="nav-link">Departments &amp; Branches</Link></li>
              )}
            </ul>
            <div className="d-flex align-items-center gap-2">
              <LanguageSwitcher />
              <span className="text-secondary small text-nowrap">{user.name} ({user.role})</span>
              <button className="btn btn-outline-secondary btn-sm" onClick={logout}>{t("nav.logout")}</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow-1 container-fluid px-3 px-md-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update `frontend/src/components/LanguageSwitcher.tsx`'s className**

Change:
```tsx
className="language-switcher"
```
to:
```tsx
className="form-select form-select-sm"
```
(keep everything else in the file unchanged).

- [ ] **Step 3: Verify in the browser**

At desktop width: nav bar shows all links inline, language switcher
and user info/logout on the right. At 375px width: the hamburger
(`navbar-toggler`) appears and toggles the nav open/closed, no
horizontal scroll (compare against the 657px-overflow bug already
fixed once in `debugging-notes.md` — confirm it doesn't reappear).
Switch to Arabic: nav mirrors correctly (brand/toggle positions flip),
no broken alignment. Notification badge still shows/hides correctly
based on `alertCount`. Logout button still works.

- [ ] **Step 4: Remove now-unused rules from `frontend/src/App.css`**

Delete the `.app-header`, its `@media (max-width: 640px)` block's
`.app-header` sub-rule, `.app-header .brand`, `.app-header nav`,
`.nav-link-with-badge`, `.notification-badge`, `.app-header-user`,
`.language-switcher`, and `.auth-language-switcher` rules (the last one
only if not still referenced elsewhere — grep for `auth-language-switcher`
across `frontend/src` first; if `LoginPage.tsx`/`RegisterPage.tsx`
still use it, leave it for Task 3 to remove instead). Leave
`.app-main`'s rule in place for now if anything else still references
it (grep first) — otherwise remove it too.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/components/LanguageSwitcher.tsx frontend/src/App.css
git commit -m "feat: migrate nav shell to Bootstrap navbar"
```

---

### Task 3: Migrate auth pages (Login, Register)

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/App.css` (remove `.auth-page`, `.auth-form`
  layout rules per the Style Guide — keep only the 320px width
  override; remove `.auth-language-switcher` here if Task 2 left it in
  place)

**Interfaces:**
- Consumes: the Bootstrap CSS from Task 1.

- [ ] **Step 1: Read the current content of both files**

Read `frontend/src/pages/LoginPage.tsx` and
`frontend/src/pages/RegisterPage.tsx` in full before editing — apply
the Style Guide's `.auth-page`/`.auth-form`/label-input/`.form-error`/
`.auth-language-switcher` mappings to each field and element exactly
as they exist in the real file (do not assume their structure matches
any other page).

- [ ] **Step 2: Apply the Style Guide mapping to both files**

For each: outer wrapper gets
`className="auth-page min-vh-100 d-flex align-items-center justify-content-center bg-light position-relative"`
(keep the small custom `.auth-page`/`.auth-form` width rule in
`App.css` — see Style Guide); the language switcher (if present on
these pages) gets `className="position-absolute top-0 end-0 m-3"`;
the form card gets `className="auth-form card p-4 shadow-sm"`; every
label/input pair is restructured to
`<div className="mb-3"><label className="form-label">...</label><input className="form-control" .../></div>`;
the submit button gets `className="btn btn-primary w-100"`; any error
message gets `className="alert alert-danger" role="alert"` (keep
`role="alert"` if already present).

- [ ] **Step 3: Verify in the browser**

Both pages render centered, forms look like real Bootstrap cards, all
fields still submit correctly (log in with the seeded admin account,
register a new customer), error states still display (try a wrong
password), at 375px the form doesn't overflow, Arabic direction still
looks correct.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/App.css
git commit -m "feat: migrate auth pages to Bootstrap"
```

---

### Task 4: Migrate list/table pages

**Files:**
- Modify: `frontend/src/pages/customers/CustomersListPage.tsx`
- Modify: `frontend/src/pages/tickets/TicketsListPage.tsx`
- Modify: `frontend/src/pages/kb/KbListPage.tsx`
- Modify: `frontend/src/pages/AuditLogPage.tsx`
- Do NOT remove `.page-header` from `frontend/src/App.css` in this
  task even though this task's own files use it — `KbDetailPage.tsx`
  (Task 5), `TicketDetailPage.tsx` (Task 5), and `ReportsPage.tsx`
  (Task 6) still reference it until their own tasks migrate them.
  Removing it here would visually break those pages' headers in the
  interim. Its removal is handled once, in Task 7's final sweep.
- Modify: `frontend/src/App.css` (remove `.table-scroll`, `.data-table`,
  `.filters`, `.search-input`, `.button-link` rules — these four are
  confirmed used only by this task's files; grep `frontend/src` first
  to double check before deleting any of them)

**Interfaces:**
- Consumes: Bootstrap CSS from Task 1; the Style Guide's
  table/filter/badge mappings.

- [ ] **Step 1: Read each file's current content before editing**

- [ ] **Step 2: Apply the Style Guide mapping to each file**

Page header (title + "create new" link) →
`className="page-header d-flex justify-content-between align-items-center mb-3"`,
the create-link → `className="btn btn-primary"`. Any search input →
`className="form-control mb-3" style={{ maxWidth: 280 }}`. Any
filter `<select>`s → wrapped in
`className="filters d-flex flex-wrap gap-2 mb-3"`, each select gets
`className="form-select form-select-sm" style={{ width: "auto" }}`.
The `<table>` gets wrapped in `<div className="table-responsive">`,
table itself gets `className="table table-striped table-hover align-middle"`.
Any SLA badge (`TicketsListPage.tsx`) uses the Style Guide's
`sla-badge` → `badge bg-success`/`bg-warning text-dark`/`bg-danger`
mapping based on the existing state logic — read how the current
component picks the state class and preserve that same
conditional logic, only changing which classes get applied.

- [ ] **Step 3: Verify in the browser**

Each of the 4 pages: table renders correctly, search/filter still
work (search for a real customer/ticket, filter tickets by status),
at 375px the table scrolls horizontally inside its own container
(page itself has no horizontal scroll), SLA badges still show the
correct color per state.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/customers/CustomersListPage.tsx frontend/src/pages/tickets/TicketsListPage.tsx frontend/src/pages/kb/KbListPage.tsx frontend/src/pages/AuditLogPage.tsx frontend/src/App.css
git commit -m "feat: migrate list/table pages to Bootstrap"
```

---

### Task 5: Migrate detail/form pages

**Files:**
- Modify: `frontend/src/pages/customers/CustomerDetailPage.tsx`
- Modify: `frontend/src/pages/customers/CustomerFormPage.tsx`
- Modify: `frontend/src/pages/tickets/TicketDetailPage.tsx`
- Modify: `frontend/src/pages/tickets/TicketFormPage.tsx`
- Modify: `frontend/src/pages/kb/KbDetailPage.tsx`
- Modify: `frontend/src/pages/kb/KbFormPage.tsx`
- Modify: `frontend/src/App.css` (remove `.entity-form*`,
  `.ticket-meta`, `.ticket-controls`, `.ticket-detail section`,
  `.message-thread`/`.message`/`.internal-tag`, `.checkbox-label`,
  `.task-list`/`.task-item`/`.task-due`, `.history-list`,
  `.ai-assist-row`/`.ai-assist-result`, `.reply-toolbar`,
  `.secondary-button`, `.kb-body`'s width/line-height parts, once
  nothing references them — keep a bare `.kb-body { white-space: pre-wrap; }` rule)

**Interfaces:**
- Consumes: Bootstrap CSS from Task 1; the Style Guide's
  form/card/list-group/badge mappings. This is the largest task —
  `TicketDetailPage.tsx` in particular has the most distinct custom
  classes of any file in the app (meta, controls, message thread,
  internal-note styling, tasks, AI-assist section, reply toolbar).

- [ ] **Step 1: Read each file's current content before editing**

Read all 6 files in full first — `TicketDetailPage.tsx` especially,
since it touches the largest number of Style Guide rows.

- [ ] **Step 2: Apply the Style Guide mapping to each file**

Every label/input pair → the same `mb-3`/`form-label`/`form-control`
restructure as Task 3. Every checkbox+label (e.g. the internal-note
checkbox on the ticket reply composer) → the `form-check` pattern.
Ticket meta line → `d-flex flex-wrap gap-4 text-secondary mb-3`.
Ticket controls (status/assign dropdowns) →
`d-flex flex-wrap gap-4 p-3 bg-light rounded mb-4`, each `<select>` →
`form-select form-select-sm` sized with `style={{ width: "auto" }}`.
Message thread → `list-group mb-3` / `list-group-item`, internal notes
→ additionally `list-group-item-warning`, the internal tag →
`badge bg-warning text-dark mb-1`. Task list → `list-group` /
`list-group-item d-flex align-items-center gap-2`, done tasks' label →
add `text-decoration-line-through text-muted`, due date → `badge text-bg-warning`.
History list → `list-group list-group-flush small text-secondary`.
AI-assist section → buttons row `d-flex flex-wrap gap-2 mb-2`, result
box → `card card-body bg-light mb-3`. Reply toolbar (quick-reply
picker) → `d-flex align-items-center gap-2 mb-2`, its `<select>` →
`form-select form-select-sm` sized `style={{ width: "auto" }}`.
Secondary/cancel buttons → `btn btn-outline-primary`. Primary submit
buttons → `btn btn-primary`. Wrap each major section of
`TicketDetailPage.tsx`/`CustomerDetailPage.tsx` (meta, controls,
message thread, AI assist, tasks, history) in `card card-body mb-3`
where it reads as a visually distinct block — use judgment per file,
guided by the existing section boundaries (the existing
`<section>`/heading structure already marks where these blocks are).

- [ ] **Step 3: Verify in the browser**

Full click-through per page: view a customer, edit a customer, view a
ticket (check meta/controls/message thread/internal-note visibility/
AI-assist buttons/tasks/history all render and still function), create
a new ticket, view/create a KB article. At 375px nothing overflows.
Internal-note visual distinction (list-group-item-warning) is still
clearly different from a normal message. Arabic RTL still looks
correct on the densest page (`TicketDetailPage.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/customers/CustomerDetailPage.tsx frontend/src/pages/customers/CustomerFormPage.tsx frontend/src/pages/tickets/TicketDetailPage.tsx frontend/src/pages/tickets/TicketFormPage.tsx frontend/src/pages/kb/KbDetailPage.tsx frontend/src/pages/kb/KbFormPage.tsx frontend/src/App.css
git commit -m "feat: migrate ticket/customer/KB detail and form pages to Bootstrap"
```

---

### Task 6: Migrate remaining pages

**Files:**
- No change needed to `frontend/src/pages/DashboardShellPage.tsx`
  itself (confirmed: it's already just `<div className="page"><h1/><p/></div>`,
  no custom classes to migrate) — only the dead `.dashboard-shell*`
  CSS rules referencing it get deleted, from `App.css` below.
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/QuickRepliesPage.tsx`
- Modify: `frontend/src/pages/AdminSlaSettingsPage.tsx`
- Modify: `frontend/src/pages/AdminOrgSettingsPage.tsx`
- Modify: `frontend/src/pages/ChatPage.tsx`
- Modify: `frontend/src/App.css` (remove `.dashboard-shell*`,
  `.report-grid`, `.report-card`, `.report-stat`, `.quick-replies-list`,
  `.kb-list`/`.kb-category`/`.kb-draft-tag` if not already removed in
  Task 5, `.page-loading` once nothing references them; **keep**
  `.trend-card`/`.trend-bars`/`.trend-bar-col`/`.trend-bar`/
  `.trend-bar-label`/`.trend-bar-count` exactly as-is per the Style
  Guide)

**Interfaces:**
- Consumes: Bootstrap CSS from Task 1; the Style Guide's grid/card
  mapping for the Reports page specifically.

- [ ] **Step 1: Read each file's current content before editing**

- [ ] **Step 2: Apply the Style Guide mapping to each file**

`DashboardShellPage.tsx` needs no edits (see Files above). `ReportsPage.tsx`: replace `.report-grid`
with Bootstrap's grid
(`row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3`), each `.report-card`
becomes `<div className="col"><div className="card h-100"><div className="card-body">`,
`.report-stat` → `display-6 fw-bold mb-0`; wrap the existing trend-bar
chart markup in `card card-body mt-3` but leave the bars' own custom
classes untouched. `QuickRepliesPage.tsx`: list → `list-group`,
list items → `list-group-item d-flex justify-content-between align-items-start`.
`AdminSlaSettingsPage.tsx`/`AdminOrgSettingsPage.tsx`: apply the same
form/table/list-group mappings as earlier tasks based on whichever
patterns each page actually uses (read first). `ChatPage.tsx`: apply
the message-thread/list-group mapping consistent with
`TicketDetailPage.tsx`'s message thread from Task 5, plus
`form-control`/`btn btn-primary` for its input/send button.

- [ ] **Step 3: Verify in the browser**

Dashboard loads and redirects correctly per role. Reports page: cards
render in a responsive grid (resize the window and confirm columns
reflow at the `md`/`lg` breakpoints), trend chart still renders
correctly. Quick replies list/create/use still works. SLA settings and
Org settings pages still save correctly. Chat page: ask a question,
get an AI answer, confirm the message thread still renders and (once
`25-live-chat.md` lands later) is compatible with adding a "Talk to a
human" button — no structural change needed for that yet, just note it
mentally.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReportsPage.tsx frontend/src/pages/QuickRepliesPage.tsx frontend/src/pages/AdminSlaSettingsPage.tsx frontend/src/pages/AdminOrgSettingsPage.tsx frontend/src/pages/ChatPage.tsx frontend/src/App.css
git commit -m "feat: migrate remaining pages to Bootstrap, remove dead dashboard-shell CSS"
```

---

### Task 7: Full-suite verification and spec closeout

**Files:**
- Modify: `frontend/src/App.css` (final cleanup sweep — see Step 1)
- Modify: `docs/specs/001-customer-support-crm/features/20-bootstrap-responsive-redesign.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Final CSS cleanup sweep**

By this point every page has been migrated, so any custom class that
was deferred by an earlier task's "once nothing references it" caveat
(most notably `.page-header`, deferred by Task 4 because Task 5/6
files still used it at the time) can now be safely removed. Grep
`frontend/src` for every remaining rule in `frontend/src/App.css` —
for each one, if zero matches remain outside `App.css` itself, delete
the rule. **Keep these regardless of reference count** (per the Style
Guide, they have no Bootstrap equivalent or are deliberately-kept
overrides): `.auth-form`'s width rule, `.trend-bars`/`.trend-bar-col`/
`.trend-bar`/`.trend-bar-label`/`.trend-bar-count`, `.kb-body`'s
`white-space: pre-wrap` rule.

- [ ] **Step 2: Full guaranteed-demo-path click-through**

Follow `docs/demo-walkthrough.md` end-to-end in the browser: Admin
login → create agent → create customer → customer creates ticket →
admin assigns → agent uses Gemini suggested reply → resolves →
customer sees resolution + submits feedback → manager views reports.
Confirm every step still works with the new Bootstrap UI.

- [ ] **Step 3: Responsive + RTL sweep**

At 375px and desktop width, in both English and Arabic, visit every
migrated page and confirm: no horizontal scroll on the page itself,
nav collapses/expands correctly on mobile, RTL mirroring looks correct
(check at least the nav, a form page, and `TicketDetailPage.tsx`),
zero console errors on any page.

- [ ] **Step 4: `npm run build` (frontend) succeeds**

Run: `cd frontend && npm run build` — confirm it completes without
errors (this also typechecks via `tsc -b`).

- [ ] **Step 5: Update the spec and verification doc**

In `20-bootstrap-responsive-redesign.md`, change `## Status: Not Started`
to `## Status: Done` and check every acceptance-criteria box that's
genuinely true based on Steps 1-4's results. Add a row to
`docs/verification.md`: `| Bootstrap responsive redesign | Full demo path + 375px/RTL sweep across all pages | PASS |`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.css docs/specs/001-customer-support-crm/features/20-bootstrap-responsive-redesign.md docs/verification.md
git commit -m "docs: mark Bootstrap responsive redesign done, record verification, final App.css cleanup"
```
