# Feature Spec: Custom Branding

**Date:** 2026-08-24
**Requirement:** CRM-BRAND-001
**Round:** Round 2 — Post-Test-Suite Enhancements, item 9 of 9 (built
last, on top of `20-bootstrap-responsive-redesign.md`'s CSS
custom-property structure)

**Reverses an earlier decision.** Custom branding was discussed and
explicitly declined by the user during the original scoping round
(`discussion-custom-branding.md`, `gap-analysis.md`'s recommendation to
explicitly not build it). The user has now asked to revisit and build it —
this spec supersedes that earlier decline; `discussion-custom-branding.md`
stays in place as the historical record of the original discussion, not
deleted or rewritten to look like it was always planned.

**Correction (2026-08-26, caught during final review):** the citation
above originally pointed at `docs/decisions.md`'s "Decided, Not Building"
section, which does not exist in that file. The original decline is
actually documented in `gap-analysis.md` (see its Platform section and
its final recommendations list, both of which name "custom branding"
among the items recommended not to build).

## Goal

Let an Admin configure this deployment's own app name, logo, and accent
color, applied across the whole UI — this is a single-organization
CRM (department/branch are internal org units of one company, not
separate tenant companies — confirmed in `17-multi-department-branch.md`),
so branding here means "make this one company's instance look like
theirs," not per-tenant multi-brand theming.

## Assumptions

- **Scope is deliberately modest:** app name, a logo (upload or URL),
  and one primary accent color. **Not** in scope: custom fonts, a full
  color palette, per-page theme overrides, or anything resembling
  white-label multi-tenant theming — this app serves one organization,
  so a single config row is sufficient, not a per-tenant theme system.
- Builds on `20-bootstrap-responsive-redesign.md`'s Bootstrap 5
  foundation: Bootstrap 5 exposes its palette as CSS custom properties
  (`--bs-primary`, etc.), so overriding the accent color is a matter of
  setting that custom property from the stored config at app load,
  not hand-patching every component's hardcoded color.
- Single config row, not a full settings table — same pattern as
  `SlaPolicy`'s existing admin-configurable-singleton approach
  (`15-sla-configuration.md`), reused here for consistency rather than
  inventing a new config-storage convention.
- Logo storage reuses whatever upload mechanism `22-attachments.md`
  introduces (local disk under `backend/uploads/`), rather than a
  second, separate upload pathway — if attachments land first (they
  do, per Round 2 order), this is a direct dependency; if branding is
  somehow built first, this spec would need its own minimal file-upload
  handling instead (does not currently anticipate that ordering, per
  the agreed Round 2 sequence).

## Scope

- **Schema:** new `BrandingConfig` model (singleton row) — `appName`,
  `logoPath` (nullable), `primaryColor` (hex string, nullable →
  falls back to Bootstrap's default primary).
- **Backend:** `GET /api/admin/branding` (public — the frontend needs
  this before login to render the branded nav/login page),
  `PATCH /api/admin/branding` (Admin only) — name, upload a new logo,
  set the accent color.
- **Frontend:**
  - New `frontend/src/pages/admin/BrandingSettingsPage.tsx` (Admin
    only), nav link alongside the existing SLA/Org settings pages.
  - App-wide: fetch branding config once at load, render the
    configured app name/logo in `Layout.tsx`'s nav, and inject a
    runtime CSS override if a custom color is set.
  - Falls back to the current default look (existing app name, no
    logo, Bootstrap's default blue) when nothing is configured —
    branding is opt-in, never a required setup step.
  - **Correction (2026-08-26, caught during plan self-review):** two
    factual corrections to the above. (1) The app name is not
    hardcoded in `Layout.tsx` — it's `t("nav.brand")`, resolving to
    "AZM Support CRM" via `frontend/src/i18n/locales/en.json`/`ar.json`.
    Branding overrides this by rendering the configured name when
    present, falling back to `t("nav.brand")` otherwise — no i18n
    file changes needed. (2) `LoginPage.tsx` (`/login`, rendered
    outside `Layout.tsx` — `Layout` itself returns `null` when logged
    out) currently shows no app name or logo at all. Since this spec's
    own stated reason for making the GET endpoint public is "the
    frontend needs this before login" and the verification plan
    explicitly reloads the app fresh to confirm branding persists,
    `LoginPage.tsx` is included in scope: it renders the same
    configured name/logo (falling back identically) above its "Sign
    in" heading. This is a minimal, natural extension of already-public
    data, not new scope — the acceptance criteria's literal "nav bar"
    wording is read as "wherever the app currently shows its identity,"
    which is Layout's nav when logged in and LoginPage when logged out.
  - **Correction (2026-08-26, caught during plan self-review):** the
    accent-color override is more involved than a single
    `--bs-primary` custom property. This app's Bootstrap 5.3
    (precompiled CSS from the `bootstrap` npm package, confirmed by
    reading `node_modules/bootstrap/dist/css/bootstrap.min.css`) bakes
    literal hex values into `.btn-primary`/`.btn-outline-primary`'s
    OWN scoped `--bs-btn-*` custom properties (e.g.
    `.btn-primary{--bs-btn-bg:#0d6efd;--bs-btn-hover-bg:#0b5ed7;...}`)
    — these are never derived from `--bs-primary` at runtime, only at
    Bootstrap's own SASS build time. Setting `--bs-primary` alone at
    `:root` would satisfy "the CSS variable was set" but would leave
    every primary button's actual rendered color unchanged, failing
    this spec's own explicit "verified visually, not just that the CSS
    variable was set" acceptance criterion. The override must also
    directly target `.btn-primary`/`.btn-outline-primary`'s `--bs-btn-*`
    variables (with computed lighter/darker shades for hover/active
    states) in addition to the `:root`-level variables that DO work
    generically (`--bs-primary`/`--bs-primary-rgb` for `.text-primary`/
    `.bg-primary`/`.border-primary` utilities, and
    `--bs-link-color-rgb`/`--bs-link-hover-color-rgb` for default `<a>`
    links, confirmed by reading the compiled CSS's `:root` block and
    its `a{color:rgba(var(--bs-link-color-rgb),...)}` rule).

## Out of scope

- Per-department or per-branch distinct branding (one config for the
  whole deployment).
- Custom fonts or full theme/palette editing.
- Branding the outbound email templates (`smtpEmailChannel.ts`'s
  plain-text emails) — a reasonable future extension, not built now.

## Acceptance criteria

- [x] Admin can set a custom app name; it appears in the nav bar and
      the browser tab title. Live-verified: after saving app name
      "Test Corp Support", `document.title` read "Test Corp Support"
      and `.navbar-brand` read "Test Corp Support" — confirmed on the
      dashboard, `/tickets`, and `/reports` after client-side
      navigation, and again after a fresh browser context (equivalent
      to a hard refresh, see below).
- [x] Admin can upload a logo; it appears in the nav bar. Live-verified:
      uploaded a 20×20 solid-green test PNG; `.navbar-brand img` was
      present (`count() > 0`) and visibly rendered (screenshot) on the
      settings page, `/tickets`, `/reports`, a fresh browser context,
      and the logged-out `/login` page.
- [x] Admin can set a primary accent color; primary buttons/nav/links
      across the app reflect it (verified visually, not just that the
      CSS variable was set). **Live computed-style evidence** (Playwright,
      real Chromium, `getComputedStyle`, not a CSS-variable string
      check): before setting branding, the Save button
      (`.btn-primary`) computed `backgroundColor` was
      `rgb(13, 110, 253)` (Bootstrap's default `#0d6efd`). After
      setting the accent color to `#8b1e3f` and saving, the same
      button's computed `backgroundColor` was `rgb(139, 30, 63)` —
      the exact RGB decomposition of `#8b1e3f` (0x8b=139, 0x1e=30,
      0x3f=63). The `.btn-outline-primary` "Run escalation sweep"
      button on `/reports` showed computed `color` and `borderColor`
      both `rgb(139, 30, 63)` as well. The retinted color was also
      confirmed by screenshot (dark red Save/Sign-in buttons, visible
      in the nav-crop and login-form-crop screenshots taken during
      verification). This confirms the runtime override actually
      repaints Bootstrap's baked-in `--bs-btn-bg`/`--bs-btn-border-color`
      custom properties on `.btn-primary`/`.btn-outline-primary`, not
      just `--bs-primary` at `:root`.
- [x] With no branding configured (fresh install), the app looks
      exactly as it does today — no regression for deployments that
      never touch this feature. Live-verified: with all branding
      cleared (Reset app name, Reset color, Remove logo, Save), the
      nav reverted to "AZM Support CRM", `.navbar-brand img` count was
      0, `document.title` was "AZM Support CRM" again, the Save/Sign-in
      buttons' computed `backgroundColor` reverted to
      `rgb(13, 110, 253)` (the exact pre-branding default), and
      `document.getElementById("branding-color-override")` returned
      `null` (the injected `<style>` tag is genuinely removed from the
      DOM, not merely emptied) — checked both immediately after
      clearing and again from a fresh, logged-out browser context
      loading `/login` directly.
- [x] Only Admin can change branding; any other role's `PATCH` attempt
      is rejected with 403. Covered by the backend automated test
      suite (role-gating test on `PATCH /api/admin/branding`), part of
      the 90/90 passing suite as of this verification pass.

## Implementation

New migration (`BrandingConfig`); `backend/src/routes/adminBranding.ts`
(new, mounted in `app.ts`); `frontend/src/pages/admin/BrandingSettingsPage.tsx`;
`frontend/src/components/Layout.tsx` (render configured name/logo);
a small CSS-custom-property injection point (exact location — likely
`frontend/src/main.tsx` or a `BrandingProvider` — decided at plan time).

## Verification plan

Set a custom name/logo/color through the UI, reload the app fresh
(hard refresh, new browser session) and confirm all three persist and
render correctly across multiple pages; then clear the config and
confirm the app reverts to its default, unbranded look with no visual
artifacts left behind.

## Status: Done
