# Discussion Spec: Custom Branding

**Status: decided 2026-08-24 — Skip.** User decision, despite this
being the lowest-risk of the four discussion items. Not building.

**Superseded 2026-08-26 by [28-custom-branding.md](28-custom-branding.md), now built.** This file remains as the historical record of the original discussion and decision.

## What was asked

The full feature catalog listed "Custom branding" under Platform.
Not in the original P0/P1 plan.

## Draft scope if approved

- A single `BrandSettings` row (not per-tenant — see note below):
  `appName`, `logoUrl` (or an uploaded asset), `primaryColor`.
- Admin-only settings page to edit these.
- `Layout.tsx` reads `appName`/`logoUrl` instead of the hardcoded
  "AZM Support CRM" text; `primaryColor` overrides the CSS custom
  property currently hardcoded in `App.css` (`#2f6fed` used for
  buttons/links/badges).
- Login/Register pages (outside `Layout`) would also need to read it.

## Why this is lighter than the other discussion items

Because there's no multi-tenancy in this app (one CRM instance = one
set of branding, not "different branding per customer/department"),
this is genuinely a small, additive, low-risk feature — a settings row
plus a handful of places that currently hardcode the brand name/color
start reading from it instead.

## Options

1. **Build it** — small addition, no architectural risk.
2. **Skip** — not in original scope; only worth doing if there's an
   actual reason (e.g. the assessment wants to see the app rebranded,
   or a real deployment needs it).

## Recommendation

Lowest-risk of the four discussion items. Reasonable to build if
wanted — genuinely small in scope, unlike the other three.
