# Feature Spec: Custom Branding

**Date:** 2026-08-24
**Requirement:** CRM-BRAND-001
**Round:** Round 2 — Post-Test-Suite Enhancements, item 9 of 9 (built
last, on top of `20-bootstrap-responsive-redesign.md`'s CSS
custom-property structure)

**Reverses an earlier decision.** Custom branding was discussed and
explicitly declined by the user during the original scoping round
(`discussion-custom-branding.md`, `docs/decisions.md`'s "Decided, Not
Building" section). The user has now asked to revisit and build it —
this spec supersedes that earlier decline; `discussion-custom-branding.md`
stays in place as the historical record of the original discussion, not
deleted or rewritten to look like it was always planned.

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
    configured app name/logo in `Layout.tsx`'s nav (replacing the
    current hardcoded "AZM Support CRM" text), and inject
    `--bs-primary` (and its dependent shades) as a CSS custom property
    override if a custom color is set.
  - Falls back to the current default look (existing app name, no
    logo, Bootstrap's default blue) when nothing is configured —
    branding is opt-in, never a required setup step.

## Out of scope

- Per-department or per-branch distinct branding (one config for the
  whole deployment).
- Custom fonts or full theme/palette editing.
- Branding the outbound email templates (`smtpEmailChannel.ts`'s
  plain-text emails) — a reasonable future extension, not built now.

## Acceptance criteria

- [ ] Admin can set a custom app name; it appears in the nav bar and
      the browser tab title.
- [ ] Admin can upload a logo; it appears in the nav bar.
- [ ] Admin can set a primary accent color; primary buttons/nav/links
      across the app reflect it (verified visually, not just that the
      CSS variable was set).
- [ ] With no branding configured (fresh install), the app looks
      exactly as it does today — no regression for deployments that
      never touch this feature.
- [ ] Only Admin can change branding; any other role's `PATCH` attempt
      is rejected with 403.

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

## Status: Not Started
