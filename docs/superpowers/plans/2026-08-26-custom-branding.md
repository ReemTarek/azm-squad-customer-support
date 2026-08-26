# Custom Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-26

**Goal:** Let an Admin configure this single-organization deployment's
app name, logo, and one primary accent color, applied across the whole
UI — opt-in, with the current default look preserved exactly when
nothing is configured.

**Architecture:** A singleton `BrandingConfig` row (the first true
fixed-id singleton in this schema — `SlaPolicy`, the closest prior
"admin-configurable" model, is actually keyed by a real business unique
value (`priority`), not a synthetic singleton id, so this pattern is new
here, not copied). A public `GET /api/admin/branding` (name/color) and
public `GET /api/admin/branding/logo` (the logo file bytes) — both
public because the frontend needs them before login, for the browser
tab title and the login page. An Admin-only `PATCH /api/admin/branding`
reusing the existing Multer upload middleware for the logo file. On the
frontend, a `BrandingProvider` fetches the config once at app load
(unconditionally, not gated on auth), sets `document.title`, injects a
runtime CSS override for the accent color, and exposes the name/logo to
`Layout.tsx`'s nav and `LoginPage.tsx`.

**Tech Stack:** Existing Prisma/Express/Multer/Vitest+Supertest backend
stack; existing React 19/Vite/TypeScript/Bootstrap 5/React
Query/react-i18next frontend stack. No new dependencies.

**Spec:** `docs/specs/001-customer-support-crm/features/28-custom-branding.md`

## Global Constraints

- `BrandingConfig` has exactly one row, always accessed by the fixed id
  `"singleton"` — enforced by `id String @id @default("singleton")`, so
  a second `create` with no explicit id would collide on the primary
  key rather than silently creating a second row.
- `GET /api/admin/branding` and `GET /api/admin/branding/logo` are
  deliberately public (no `requireAuth`) — the browser tab title and
  the login page's branding must render before any authentication has
  happened. `PATCH /api/admin/branding` is `requireRole("Admin")` only;
  any other role's attempt is rejected 403.
- The logo upload reuses the existing `upload` middleware and
  `UPLOAD_DIR` from `backend/src/lib/upload.ts` verbatim — no second
  upload pathway. The logo is served through its own public route
  (`GET /api/admin/branding/logo`), never through the existing
  authenticated `/api/attachments/:id` route, since an `<img src>`
  cannot attach an Authorization header.
- The accent-color override must retint actual rendered button colors,
  not just set a CSS custom property that nothing reads — see the
  spec's correction note on `.btn-primary`/`.btn-outline-primary`
  baking literal hex values into their own scoped `--bs-btn-*`
  variables, independent of `--bs-primary`. This gets a dedicated,
  visually-verified task (Task 3), not a one-line `:root` override.
- Every override (name, logo, color) is conditional on a stored,
  non-null value — a fresh install with an empty `BrandingConfig` table
  (or a config explicitly cleared back to nulls) must look and behave
  exactly as the app does today, with zero visual artifacts.
- Out of scope: per-department/branch branding, custom fonts or full
  palette editing, branding the outbound SMTP email templates.

---

### Task 1: `BrandingConfig` schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `BrandingConfig` model (`id` fixed to `"singleton"`,
  `appName String?`, `logoPath String?`, `primaryColor String?`,
  `updatedAt DateTime @updatedAt`), consumed by Task 2.

- [ ] **Step 1: Add the model**

Add this model to `backend/prisma/schema.prisma`, near `SlaPolicy`:

```prisma
model BrandingConfig {
  id           String   @id @default("singleton")
  appName      String?
  logoPath     String?
  primaryColor String?
  updatedAt    DateTime @updatedAt
}
```

`appName` is nullable — the spec explicitly marks `logoPath`/
`primaryColor` as nullable-with-fallback but doesn't state `appName`'s
nullability; for consistency with "falls back to the current default
look when nothing is configured" (which names the app name as one of
the three fallback cases), `appName` gets the identical nullable-with-
fallback treatment as the other two fields, not a required value.

- [ ] **Step 2: Generate and apply the migration**

Run: `cd backend && npx prisma migrate dev --name add_branding_config`.
If a stale `npm run dev`/Prisma Studio process from an earlier session
is holding a file lock on the Prisma engine binary, identify and kill
it before retrying — this is an environmental issue, not a schema
problem, and has recurred repeatedly across this project's Round 2
work.

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all 82 existing tests still pass (schema-only change).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add BrandingConfig schema"
```

---

### Task 2: Backend — branding read/write/logo endpoints

**Files:**
- Create: `backend/src/validation/branding.schema.ts`
- Create: `backend/src/routes/adminBranding.ts`
- Modify: `backend/src/app.ts`
- Create: `backend/tests/adminBranding.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/branding` (public) →
  `{ config: { appName: string|null, primaryColor: string|null, logoUrl: string|null } }`;
  `GET /api/admin/branding/logo` (public) → the logo file bytes, or 404
  if none configured; `PATCH /api/admin/branding` (Admin,
  `multipart/form-data`, fields `appName?`, `primaryColor?`,
  `removeLogo?` ("true"/"false"), file field `logo?`) →
  `{ config: {...} }` in the same shape as GET. Consumed by Task 3's
  `brandingApi.ts`.

**Design note on clearing fields:** `multipart/form-data` bodies only
carry strings (or omit a field entirely) — there's no way to send a
JSON `null`. So this endpoint's convention is: a field **omitted**
means "don't touch the stored value"; `appName`/`primaryColor` sent as
an **empty string** means "clear it back to null/default"; a `logo`
file present means "replace the logo"; `removeLogo=true` (with no
`logo` file) means "clear the logo back to null." This mirrors how the
frontend settings form will work — a text input cleared to empty, a
"remove logo" action distinct from "upload a new one."

- [ ] **Step 1: Read the current `adminSlaConfig.ts` and `upload.ts` for the patterns being reused**

Read `backend/src/routes/adminSlaConfig.ts` in full (39 lines — the
role-gating/`writeAuditLog` style to match) and `backend/src/lib/upload.ts`
in full (69 lines — confirm `upload`/`UPLOAD_DIR`/`MAX_FILE_SIZE_BYTES`
exports haven't changed) before writing the new route file.

- [ ] **Step 2: Add the validation schema**

Create `backend/src/validation/branding.schema.ts`:

```typescript
import { z } from "zod";

export const updateBrandingSchema = z.object({
  appName: z.string().trim().max(100).optional(),
  primaryColor: z
    .union([
      z.string().regex(/^#[0-9a-fA-F]{6}$/, "primaryColor must be a 6-digit hex color like #2f6fed"),
      z.literal(""),
    ])
    .optional(),
  removeLogo: z.enum(["true", "false"]).optional(),
});
```

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/adminBranding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("admin branding", () => {
  it("returns all-null defaults when unconfigured (public, no auth needed)", async () => {
    const res = await request(app).get("/api/admin/branding");

    expect(res.status).toBe(200);
    expect(res.body.config).toEqual({ appName: null, primaryColor: null, logoUrl: null });
  });

  it("404s the logo route when no logo is configured", async () => {
    const res = await request(app).get("/api/admin/branding/logo");
    expect(res.status).toBe(404);
  });

  it("rejects a non-Admin PATCH with 403", async () => {
    const agent = await createUser({ email: "brandagent@test.com", role: "Agent" });
    const token = tokenFor(agent);

    const res = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Agent's Attempted Brand");

    expect(res.status).toBe(403);
    const check = await request(app).get("/api/admin/branding");
    expect(check.body.config.appName).toBeNull();
  });

  it("lets an Admin set the app name and color, and the change is publicly visible", async () => {
    const admin = await createUser({ email: "brandadmin1@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const patchRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Acme Support")
      .field("primaryColor", "#2f6fed");

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.config).toEqual({ appName: "Acme Support", primaryColor: "#2f6fed", logoUrl: null });

    const publicRes = await request(app).get("/api/admin/branding");
    expect(publicRes.body.config).toEqual({ appName: "Acme Support", primaryColor: "#2f6fed", logoUrl: null });
  });

  it("rejects a malformed primaryColor", async () => {
    const admin = await createUser({ email: "brandadmin2@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("primaryColor", "blue");

    expect(res.status).toBe(400);
  });

  it("lets an Admin upload a logo, and it's servable publicly", async () => {
    const admin = await createUser({ email: "brandadmin3@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const patchRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("fake-png-bytes"), { filename: "logo.png", contentType: "image/png" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.config.logoUrl).toBe("/api/admin/branding/logo");

    const logoRes = await request(app).get("/api/admin/branding/logo");
    expect(logoRes.status).toBe(200);
  });

  it("clears the app name and color back to null via empty-string fields", async () => {
    const admin = await createUser({ email: "brandadmin4@test.com", role: "Admin" });
    const token = tokenFor(admin);

    await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Temporary Name")
      .field("primaryColor", "#123456");

    const clearRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "")
      .field("primaryColor", "");

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.config).toEqual({ appName: null, primaryColor: null, logoUrl: null });
  });

  it("clears the logo via removeLogo=true, and the old file is deleted from disk", async () => {
    const admin = await createUser({ email: "brandadmin5@test.com", role: "Admin" });
    const token = tokenFor(admin);

    await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("fake-png-bytes-2"), { filename: "logo2.png", contentType: "image/png" });

    const configBefore = await prisma.brandingConfig.findUnique({ where: { id: "singleton" } });
    const storedPath = configBefore!.logoPath!;

    const clearRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("removeLogo", "true");

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.config.logoUrl).toBeNull();

    const { UPLOAD_DIR } = await import("../src/lib/upload");
    const fs = await import("node:fs");
    const path = await import("node:path");
    expect(fs.existsSync(path.join(UPLOAD_DIR, storedPath))).toBe(false);

    const logoRes = await request(app).get("/api/admin/branding/logo");
    expect(logoRes.status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `cd backend && npm test -- adminBranding.test.ts`
Expected: all FAIL or error — the route doesn't exist yet (no
`backend/src/routes/adminBranding.ts`, not mounted in `app.ts`).

- [ ] **Step 5: Write the route file**

Create `backend/src/routes/adminBranding.ts`:

```typescript
import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { upload, UPLOAD_DIR } from "../lib/upload";
import { updateBrandingSchema } from "../validation/branding.schema";
import { writeAuditLog } from "../lib/audit";
import type { BrandingConfig } from "@prisma/client";

const router = Router();

const SINGLETON_ID = "singleton";

function toBrandingDto(config: BrandingConfig | null) {
  return {
    appName: config?.appName ?? null,
    primaryColor: config?.primaryColor ?? null,
    logoUrl: config?.logoPath ? "/api/admin/branding/logo" : null,
  };
}

router.get("/", async (_req, res) => {
  const config = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });
  res.json({ config: toBrandingDto(config) });
});

router.get("/logo", async (_req, res, next) => {
  const config = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!config?.logoPath) throw Errors.notFound("No logo configured");

  // Defense in depth: logoPath is always server-generated (a random
  // UUID filename with no path separators — see lib/upload.ts), so this
  // join can never actually escape UPLOAD_DIR today. Checking it anyway
  // matches the same guarantee attachments.ts keeps local to its route.
  const filePath = path.resolve(UPLOAD_DIR, config.logoPath);
  if (filePath !== UPLOAD_DIR && !filePath.startsWith(UPLOAD_DIR + path.sep)) {
    throw Errors.notFound("No logo configured");
  }

  res.sendFile(filePath, (err) => {
    if (err) next(Errors.notFound("Logo file not found"));
  });
});

router.patch("/", requireAuth, requireRole("Admin"), upload.single("logo"), async (req, res) => {
  const body = updateBrandingSchema.parse(req.body);
  const existing = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });

  const data: { appName?: string | null; primaryColor?: string | null; logoPath?: string | null } = {};
  if (body.appName !== undefined) data.appName = body.appName === "" ? null : body.appName;
  if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor === "" ? null : body.primaryColor;

  if (req.file) {
    data.logoPath = req.file.filename;
  } else if (body.removeLogo === "true") {
    data.logoPath = null;
  }

  // Best-effort cleanup of the previous logo file when it's being
  // replaced or removed — a cleanup failure never fails the request
  // (caught and logged, not thrown), but IS awaited before responding
  // so that by the time a client sees the response, the old file has
  // genuinely already been deleted (or the failure already logged) —
  // not still in flight. This keeps the response a reliable signal of
  // the operation's actual on-disk state instead of a race between the
  // response and a background unlink.
  if (data.logoPath !== undefined && existing?.logoPath && existing.logoPath !== data.logoPath) {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, existing.logoPath));
    } catch (err) {
      console.error("Old logo file cleanup failed (non-fatal):", err);
    }
  }

  const config = await prisma.brandingConfig.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });

  await writeAuditLog(req.user!.id, "branding.update", "BrandingConfig", config.id, data);

  res.json({ config: toBrandingDto(config) });
});

export default router;
```

- [ ] **Step 6: Mount the router**

In `backend/src/app.ts`, add the import alongside the other route
imports:

```typescript
import adminBrandingRouter from "./routes/adminBranding";
```

Add the mount right after the existing `adminSlaConfigRouter` line
(before the generic `adminOrgRouter` mount, matching that ordering):

```typescript
app.use("/api/admin/branding", adminBrandingRouter);
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `cd backend && npm test -- adminBranding.test.ts`
Expected: all tests pass.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (82 existing + 8 new = 90).

- [ ] **Step 8: Commit**

```bash
git add backend/src/validation/branding.schema.ts backend/src/routes/adminBranding.ts backend/src/app.ts backend/tests/adminBranding.test.ts
git commit -m "feat: add branding read/write/logo endpoints"
```

---

### Task 3: Frontend — branding provider, accent-color override, Layout/LoginPage rendering

**Files:**
- Create: `frontend/src/lib/brandingApi.ts`
- Create: `frontend/src/lib/brandColor.ts`
- Create: `frontend/src/context/BrandingContext.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/branding` from Task 2.
- Produces: `useBranding()` hook (`{ appName: string|null, logoUrl: string|null }`),
  consumed by `Layout.tsx`, `LoginPage.tsx`, and Task 4's settings page
  (to show the current values before editing).

This task has no backend dependency beyond Task 2's already-shipped
`GET` endpoint, and is verified primarily through live browser
behavior (Step 8) rather than unit tests, matching this project's
established convention for frontend features (no automated frontend
test suite exists).

- [ ] **Step 1: Read the current files**

Read `frontend/src/main.tsx` (21 lines), `frontend/src/components/Layout.tsx`
(95 lines), and `frontend/src/pages/LoginPage.tsx` (55 lines) in full —
confirm they match this plan's excerpts (both were read during this
plan's writing on 2026-08-26; `Layout.tsx` in particular has been
touched by several prior features and may have shifted).

- [ ] **Step 2: `brandingApi.ts`**

Create `frontend/src/lib/brandingApi.ts`:

```typescript
import { apiClient } from "./apiClient";

export interface BrandingConfig {
  appName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, "");

export async function getBranding() {
  const { data } = await apiClient.get<{ config: BrandingConfig }>("/admin/branding");
  return data.config;
}

// logoUrl from the backend is a relative path (e.g. "/api/admin/branding/logo")
// — an <img> tag needs an absolute URL, and it must bypass apiClient
// entirely (no Authorization header attached, matching the route's
// deliberately public/unauthenticated design).
export function absoluteLogoUrl(logoUrl: string | null): string | null {
  return logoUrl ? `${apiOrigin}${logoUrl}` : null;
}

export async function updateBranding(input: {
  appName?: string;
  primaryColor?: string;
  logo?: File;
  removeLogo?: boolean;
}) {
  const form = new FormData();
  if (input.appName !== undefined) form.append("appName", input.appName);
  if (input.primaryColor !== undefined) form.append("primaryColor", input.primaryColor);
  if (input.logo) form.append("logo", input.logo);
  if (input.removeLogo) form.append("removeLogo", "true");

  const { data } = await apiClient.patch<{ config: BrandingConfig }>("/admin/branding", form);
  return data.config;
}
```

(No manual `Content-Type: multipart/form-data` header — matches
`attachmentsApi.ts`'s established pattern of letting axios auto-detect
a `FormData` body and set the correct boundary itself.)

- [ ] **Step 3: `brandColor.ts` — the runtime accent-color override**

Create `frontend/src/lib/brandColor.ts`:

```typescript
const STYLE_ELEMENT_ID = "branding-color-override";

function hexToRgbTriplet(hex: string): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `${r}, ${g}, ${b}`;
}

// A simple linear lighten/darken (percent negative = darker, positive =
// lighter) — not Bootstrap's own SASS shade-color()/tint-color() (those
// only run at build time), but close enough to produce a genuinely
// distinct, sensible hover/active shade at runtime.
function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 0xff) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Injects (or removes, when color is null) a <style> block overriding
 * Bootstrap's primary-color custom properties at runtime. Two distinct
 * targets are needed: :root-level variables that Bootstrap's compiled
 * CSS genuinely reads generically (--bs-primary/--bs-primary-rgb for
 * .text-primary/.bg-primary/.border-primary, --bs-link-color-rgb for
 * default <a> links), and .btn-primary/.btn-outline-primary's OWN
 * scoped --bs-btn-* variables, which Bootstrap's precompiled CSS bakes
 * to literal hex values independent of --bs-primary — overriding only
 * the :root variable would leave every primary button's actual
 * rendered color unchanged.
 */
export function applyBrandColor(hex: string | null): void {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!hex) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }

  const rgb = hexToRgbTriplet(hex);
  const hoverShade = shadeColor(hex, -15);
  const activeShade = shadeColor(hex, -20);

  styleEl.textContent = `
    :root {
      --bs-primary: ${hex};
      --bs-primary-rgb: ${rgb};
      --bs-link-color: ${hex};
      --bs-link-color-rgb: ${rgb};
      --bs-link-hover-color: ${hoverShade};
      --bs-link-hover-color-rgb: ${hexToRgbTriplet(hoverShade)};
    }
    .btn-primary {
      --bs-btn-bg: ${hex};
      --bs-btn-border-color: ${hex};
      --bs-btn-hover-bg: ${hoverShade};
      --bs-btn-hover-border-color: ${hoverShade};
      --bs-btn-active-bg: ${activeShade};
      --bs-btn-active-border-color: ${activeShade};
      --bs-btn-disabled-bg: ${hex};
      --bs-btn-disabled-border-color: ${hex};
      --bs-btn-focus-shadow-rgb: ${rgb};
    }
    .btn-outline-primary {
      --bs-btn-color: ${hex};
      --bs-btn-border-color: ${hex};
      --bs-btn-hover-bg: ${hex};
      --bs-btn-hover-border-color: ${hex};
      --bs-btn-active-bg: ${hex};
      --bs-btn-active-border-color: ${hex};
      --bs-btn-disabled-color: ${hex};
      --bs-btn-disabled-border-color: ${hex};
      --bs-btn-focus-shadow-rgb: ${rgb};
    }
  `;
}
```

- [ ] **Step 4: `BrandingContext.tsx`**

Create `frontend/src/context/BrandingContext.tsx`:

```tsx
import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBranding, absoluteLogoUrl } from "../lib/brandingApi";
import { applyBrandColor } from "../lib/brandColor";

const DEFAULT_APP_NAME = "AZM Support CRM";

interface BrandingValue {
  appName: string | null;
  logoUrl: string | null;
}

const BrandingContext = createContext<BrandingValue>({ appName: null, logoUrl: null });

export function BrandingProvider({ children }: { children: ReactNode }) {
  // Deliberately NOT gated on auth state (no `enabled: Boolean(user)`)
  // — branding must apply on the login page and set the browser tab
  // title before any authentication has happened.
  const { data } = useQuery({ queryKey: ["branding"], queryFn: getBranding });

  useEffect(() => {
    document.title = data?.appName ?? DEFAULT_APP_NAME;
  }, [data?.appName]);

  useEffect(() => {
    applyBrandColor(data?.primaryColor ?? null);
  }, [data?.primaryColor]);

  const value: BrandingValue = {
    appName: data?.appName ?? null,
    logoUrl: absoluteLogoUrl(data?.logoUrl ?? null),
  };

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
```

- [ ] **Step 5: Wire `BrandingProvider` into `main.tsx`**

In `frontend/src/main.tsx`, add the import:

```typescript
import { BrandingProvider } from './context/BrandingContext'
```

Wrap `<App />` with it, inside `QueryClientProvider` (so `useQuery`
works) and around `AuthProvider` (so it never depends on auth state):

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Render the configured name/logo in `Layout.tsx`**

In `frontend/src/components/Layout.tsx`, add the import:

```typescript
import { useBranding } from "../context/BrandingContext";
```

Add the hook call inside the component, alongside the existing
`useAuth()`/`useTranslation()` calls:

```typescript
  const { appName, logoUrl } = useBranding();
```

Change the navbar-brand `<Link>`:

```tsx
          <Link to="/" className="navbar-brand fw-bold d-flex align-items-center gap-2">
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 28 }} />}
            {appName ?? t("nav.brand")}
          </Link>
```

- [ ] **Step 7: Render the configured name/logo in `LoginPage.tsx`**

In `frontend/src/pages/LoginPage.tsx`, add the import:

```typescript
import { useBranding } from "../context/BrandingContext";
```

Add the hook call inside the component:

```typescript
  const { appName, logoUrl } = useBranding();
```

Add a branded header above the existing `<h1>{t("auth.signIn")}</h1>`
line, inside the same `<form>`:

```tsx
        <div className="d-flex align-items-center gap-2 mb-3">
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 32 }} />}
          <span className="fw-bold fs-5">{appName ?? t("nav.brand")}</span>
        </div>
        <h1>{t("auth.signIn")}</h1>
```

- [ ] **Step 8: `npx tsc --noEmit` clean, `npm run build` succeeds, then live browser verification**

Run `cd frontend && npx tsc --noEmit` and `cd frontend && npm run build`.

Then, with both dev servers running and no branding configured yet
(fresh DB from Task 1-2's migration, no `PATCH` sent), verify live in
a browser: the nav shows the default `t("nav.brand")` text with no
logo, the browser tab title is "AZM Support CRM", and `/login` shows
the same default text with no logo — i.e., **zero visible difference**
from before this task, confirming the opt-in fallback behavior holds
with nothing configured yet (Task 4's settings page doesn't exist
until the next task, so this task can only be verified pre-configuration
at this point — Task 5 verifies the fully-configured state end-to-end
once Task 4 exists).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/brandingApi.ts frontend/src/lib/brandColor.ts frontend/src/context/BrandingContext.tsx frontend/src/main.tsx frontend/src/components/Layout.tsx frontend/src/pages/LoginPage.tsx
git commit -m "feat: add branding provider, accent-color override, and nav/login rendering"
```

---

### Task 4: Frontend — Branding settings page

**Files:**
- Create: `frontend/src/pages/admin/BrandingSettingsPage.tsx`
- Modify: `frontend/src/components/Layout.tsx` (nav link)
- Modify: `frontend/src/App.tsx` (route)

**Interfaces:**
- Consumes: `getBranding`/`updateBranding` from Task 3's `brandingApi.ts`.

- [ ] **Step 1: Read the current files**

Read `frontend/src/pages/AdminSlaSettingsPage.tsx` in full (87 lines —
the closest existing admin-settings-page pattern to mirror: form state,
`useMutation`, save-per-section feedback) and the current
`frontend/src/components/Layout.tsx`/`frontend/src/App.tsx` (both
modified by Task 3 — confirm their current real state before adding
to them further).

- [ ] **Step 2: Write `BrandingSettingsPage.tsx`**

Create `frontend/src/pages/admin/BrandingSettingsPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranding, updateBranding, absoluteLogoUrl } from "../../lib/brandingApi";
import { extractApiErrorMessage } from "../../lib/apiClient";

export function BrandingSettingsPage() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ["branding"], queryFn: getBranding });

  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0d6efd");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setAppName(config.appName ?? "");
      setPrimaryColor(config.primaryColor ?? "#0d6efd");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBranding({
        appName,
        primaryColor,
        logo: logoFile ?? undefined,
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearNameMutation = useMutation({
    mutationFn: () => updateBranding({ appName: "" }),
    onSuccess: () => {
      setAppName("");
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearColorMutation = useMutation({
    mutationFn: () => updateBranding({ primaryColor: "" }),
    onSuccess: () => {
      setPrimaryColor("#0d6efd");
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const clearLogoMutation = useMutation({
    mutationFn: () => updateBranding({ removeLogo: true }),
    onSuccess: () => {
      setLogoFile(null);
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    saveMutation.mutate();
  }

  if (isLoading) return <p>Loading…</p>;

  const currentLogoUrl = absoluteLogoUrl(config?.logoUrl ?? null);

  return (
    <div className="page">
      <h1>Branding</h1>
      <p className="form-text text-muted">
        Customize this deployment's app name, logo, and accent color. Leave anything unset to keep the default look.
      </p>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      {saved && !error && <p className="alert alert-success">Saved.</p>}
      <form onSubmit={handleSubmit} className="card card-body" style={{ maxWidth: 480 }}>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-app-name">App name</label>
          <div className="input-group">
            <input
              id="branding-app-name"
              className="form-control"
              placeholder="AZM Support CRM"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => clearNameMutation.mutate()}
              disabled={clearNameMutation.isPending || !config?.appName}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-color">Primary color</label>
          <div className="input-group">
            <input
              id="branding-color"
              type="color"
              className="form-control form-control-color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => clearColorMutation.mutate()}
              disabled={clearColorMutation.isPending || !config?.primaryColor}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="branding-logo">Logo</label>
          {currentLogoUrl && (
            <div className="mb-2">
              <img src={currentLogoUrl} alt="Current logo" style={{ height: 40 }} />
            </div>
          )}
          <input
            id="branding-logo"
            type="file"
            className="form-control"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
          {config?.logoUrl && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-2"
              onClick={() => clearLogoMutation.mutate()}
              disabled={clearLogoMutation.isPending}
            >
              Remove logo
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `frontend/src/components/Layout.tsx`, add a new Admin-only nav
`<li>` alongside the existing SLA/Org/Users settings links (after the
"Departments & Branches" link, matching the existing block's style):

```tsx
              {user.role === "Admin" && (
                <li className="nav-item"><Link to="/admin/branding" className="nav-link">Branding</Link></li>
              )}
```

- [ ] **Step 4: Add the route**

In `frontend/src/App.tsx`, add the import:

```typescript
import { BrandingSettingsPage } from "./pages/admin/BrandingSettingsPage";
```

Add the route, alongside the other `/admin/*` routes:

```tsx
          <Route
            path="/admin/branding"
            element={
              <RequireAuth roles={["Admin"]}>
                <BrandingSettingsPage />
              </RequireAuth>
            }
          />
```

- [ ] **Step 5: `npx tsc --noEmit` clean, `npm run build` succeeds**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/BrandingSettingsPage.tsx frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat: add branding settings page"
```

---

### Task 5: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/28-custom-branding.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-057 Done)
- Modify: `docs/specs/001-customer-support-crm/features/README.md` (index entry)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all 90 tests pass.

- [ ] **Step 2: `npx tsc --noEmit` clean in both `backend/` and `frontend/`; `npm run build` succeeds in `frontend/`**

- [ ] **Step 3: Full live verification, per the spec's own verification plan — this is the task that actually exercises the "verified visually" acceptance criterion**

Using Playwright (or an equivalent real-browser driver):

1. As Admin, go to `/admin/branding`. Set app name to a distinctive
   test value (e.g. "Test Corp Support"), set the primary color to a
   visually distinct hex (e.g. `#8b1e3f`, a dark red — clearly
   different from Bootstrap's default blue), upload a small test logo
   image, and Save.
2. Confirm immediately: the nav bar shows the new name and logo, the
   browser tab title updated, and — critically — take a screenshot or
   read `getComputedStyle(...)` on a real `.btn-primary` element
   (e.g. the "Save" button just clicked, or any other primary button
   visible on the page) and confirm its background color genuinely
   changed to the configured color — not merely that the `--bs-primary`
   CSS variable string exists somewhere in `document.styleSheets`.
   Check at least one `.btn-outline-primary` element too if one is
   visible on the current page.
3. Navigate to a few other pages (Tickets list, Reports) and confirm
   the nav name/logo/button color persist across client-side navigation.
4. Do a **hard refresh** (or open a fresh browser context/incognito
   window) and confirm all three (name, logo, color) still render
   correctly — this proves the config is genuinely persisted
   server-side and re-fetched on load, not just held in in-memory
   React state from the settings page's own mutation response.
5. Log out (or open a fresh incognito context) and load `/login`
   directly — confirm the configured name/logo appear there too, with
   no authentication.
6. Back in `/admin/branding`, use the three "Reset"/"Remove logo"
   controls to clear all three fields back to defaults, and Save.
   Confirm the nav, tab title, and button colors all revert to exactly
   the pre-branding default look (Bootstrap's default blue, the
   default app name, no logo) with no leftover visual artifacts (e.g.
   no stray empty `<img>` tag, no lingering `<style>` override — check
   `document.getElementById("branding-color-override")` is genuinely
   removed from the DOM, not just emptied).

- [ ] **Step 4: Update the spec, verification doc, implementation plan, and features index**

In `28-custom-branding.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box with genuine
evidence from Steps 1-3 — in particular, the third criterion ("primary
buttons/nav/links across the app reflect it (verified visually, not
just that the CSS variable was set)") should cite the specific
computed-style/screenshot evidence from Step 3.2, not just that the
feature was built.

Add a row to `docs/verification.md`:
`| Custom branding (name, logo, accent color) | Automated tests (config CRUD, role gating, logo serving/clearing) + live browser verification (visual button re-tint, cross-page persistence, hard-refresh persistence, pre-login rendering, full clear-and-revert) | PASS |`.

In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-057 in the "Round 2" table and change its status from
`Not Started` to `Done` — this is the last remaining Round 2 item
besides TASK-053 (SMS/WhatsApp, still blocked on credentials), so note
in the table (or in a short paragraph above/below it, matching this
project's existing style for such notes) that Round 2 is now complete
except for that one credential-blocked item.

In `docs/specs/001-customer-support-crm/features/README.md`, add one
sentence for item 28 in the same style as items 20-23/26/27, and update
the summary paragraph so nothing incorrectly says any Round 2 item
besides 24 (SMS/WhatsApp) remains outstanding.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/28-custom-branding.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md docs/specs/001-customer-support-crm/features/README.md
git commit -m "docs: mark custom branding done, record verification"
```
