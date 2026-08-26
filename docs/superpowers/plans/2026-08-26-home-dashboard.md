# Role-Aware Home Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-26

**Goal:** Replace the `/` landing page's bare "Welcome, {name}" placeholder
with a role-aware dashboard, reusing only existing, already-role-scoped
backend endpoints — no new backend surface.

**Architecture:** A full rewrite of `frontend/src/pages/DashboardShellPage.tsx`
that branches on `user.role` and fires only the queries each role needs
(each gated via React Query's `enabled` option, so an Agent's browser
never even attempts a call to an Admin/Manager-only endpoint). Every
data source already exists: `listTickets()`, `getNotificationsSummary()`,
`getReportsSummary()`, `getReportsTrends()`, `getAiUsageReport()`.

**Tech Stack:** Existing React 19/Vite/TypeScript/Bootstrap 5/React
Query/react-i18next frontend stack. No new dependencies, no backend
changes.

**Spec:** `docs/specs/001-customer-support-crm/features/29-home-dashboard.md`

## Global Constraints

- No new backend endpoint, route, or schema change — every widget's
  data comes from an endpoint that already existed before this feature.
- Each role's queries are gated (`enabled: ...`) so no role's browser
  ever calls an endpoint it isn't authorized for.
- "Top N" ticket lists are sorted client-side after the already-scoped
  fetch — no new backend sort parameter.
- Every widget degrades gracefully with zero data — an empty ticket
  list shows a clear message, not a blank gap or an error.
- No backend code changes in this plan, so there is no backend test
  suite to run for any step below — verification is `tsc`/`build` plus
  live browser checks only, matching this project's established
  convention for frontend-only features (no automated frontend test
  suite exists).

---

### Task 1: Rewrite the dashboard page

**Files:**
- Modify: `frontend/src/pages/DashboardShellPage.tsx`
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/ar.json`

**Interfaces:**
- Consumes: `listTickets()` (`frontend/src/lib/ticketsApi.ts`),
  `getNotificationsSummary()` (`frontend/src/lib/notificationsApi.ts`),
  `getReportsSummary()`/`getReportsTrends()`/`getAiUsageReport()`
  (`frontend/src/lib/reportsApi.ts`) — all already exist, no changes
  needed to any of them.

- [ ] **Step 1: Read the current files**

Read `frontend/src/pages/DashboardShellPage.tsx` (14 lines — confirm
it's still the placeholder described in the spec), `frontend/src/lib/ticketsApi.ts`
(confirm `Ticket`'s `slaState`/`updatedAt` fields and `listTickets()`'s
signature — it already returns only the caller's own-scoped tickets
with no filter needed, per the backend's server-side role scoping),
and `frontend/src/components/SlaBadge.tsx` (confirm its exact prop
shape) before writing the new page.

- [ ] **Step 2: Rewrite `DashboardShellPage.tsx`**

Replace the full contents of `frontend/src/pages/DashboardShellPage.tsx`
with:

```tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { listTickets } from "../lib/ticketsApi";
import type { Ticket } from "../lib/ticketsApi";
import { getNotificationsSummary } from "../lib/notificationsApi";
import { getReportsSummary, getReportsTrends, getAiUsageReport } from "../lib/reportsApi";
import { SlaBadge } from "../components/SlaBadge";

const SLA_SORT_ORDER: Record<Ticket["slaState"], number> = { breached: 0, at_risk: 1, on_track: 2 };

function byRecency(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function bySlaUrgencyThenRecency(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const slaDiff = SLA_SORT_ORDER[a.slaState] - SLA_SORT_ORDER[b.slaState];
    if (slaDiff !== 0) return slaDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function DashboardShellPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const ticketsQuery = useQuery({
    queryKey: ["dashboard-tickets"],
    queryFn: () => listTickets(),
    enabled: user?.role === "Customer" || user?.role === "Agent",
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: getNotificationsSummary,
    enabled: user?.role === "Agent",
  });

  const summaryQuery = useQuery({
    queryKey: ["reports-summary"],
    queryFn: getReportsSummary,
    enabled: user?.role === "Admin" || user?.role === "Manager",
  });

  const trendsQuery = useQuery({
    queryKey: ["reports-trends"],
    queryFn: getReportsTrends,
    enabled: user?.role === "Admin" || user?.role === "Manager",
  });

  const aiUsageQuery = useQuery({
    queryKey: ["reports-ai-usage"],
    queryFn: getAiUsageReport,
    enabled: user?.role === "Admin",
  });

  const topTickets = useMemo(() => {
    if (!ticketsQuery.data) return [];
    const sorted = user?.role === "Agent" ? bySlaUrgencyThenRecency(ticketsQuery.data) : byRecency(ticketsQuery.data);
    return sorted.slice(0, 5);
  }, [ticketsQuery.data, user?.role]);

  if (!user) return null;

  const isStaffReportRole = user.role === "Admin" || user.role === "Manager";

  return (
    <div className="page">
      <h1>{t("dashboard.welcome", { name: user.name })}</h1>

      {(user.role === "Customer" || user.role === "Agent") && (
        <section className="card card-body mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">{t("dashboard.myTickets")}</h2>
            {user.role === "Customer" && (
              <Link to="/tickets/new" className="btn btn-sm btn-primary">{t("dashboard.newTicket")}</Link>
            )}
            {user.role === "Agent" && (
              <Link to="/tickets" className="btn btn-sm btn-outline-primary">{t("dashboard.viewAllMyTickets")}</Link>
            )}
          </div>
          {ticketsQuery.isLoading && <p className="mb-0">{t("dashboard.loading")}</p>}
          {ticketsQuery.data && topTickets.length === 0 && (
            <p className="text-muted mb-0">
              {user.role === "Customer" ? t("dashboard.noTicketsCustomer") : t("dashboard.noTicketsAgent")}
            </p>
          )}
          {topTickets.length > 0 && (
            <ul className="list-group list-group-flush">
              {topTickets.map((ticket) => (
                <li key={ticket.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <Link to={`/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  <span className="d-flex align-items-center gap-2">
                    <span className="badge bg-secondary">{ticket.status}</span>
                    <SlaBadge state={ticket.slaState} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {user.role === "Agent" && notificationsQuery.data && (
        <div className="row row-cols-1 row-cols-md-2 g-3 mb-3">
          <div className="col">
            <div className="card h-100">
              <div className="card-body">
                <h2 className="h5 card-title">{t("dashboard.slaAlerts")}</h2>
                <p className="display-6 fw-bold mb-0">
                  {notificationsQuery.data.breachedCount + notificationsQuery.data.atRiskCount}
                </p>
                <p className="form-text text-muted">
                  {notificationsQuery.data.breachedCount} {t("dashboard.breached")}, {notificationsQuery.data.atRiskCount} {t("dashboard.atRisk")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStaffReportRole && (summaryQuery.isLoading || trendsQuery.isLoading) && <p>{t("dashboard.loading")}</p>}

      {isStaffReportRole && (summaryQuery.data || trendsQuery.data) && (
        <>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 mb-3">
            {summaryQuery.data?.byStatus.map((s) => (
              <div className="col" key={s.status}>
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h5 card-title">{s.status}</h2>
                    <p className="display-6 fw-bold mb-0">{s.count}</p>
                  </div>
                </div>
              </div>
            ))}
            {summaryQuery.data && (
              <div className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h5 card-title">{t("dashboard.avgResolution")}</h2>
                    <p className="display-6 fw-bold mb-0">
                      {summaryQuery.data.avgResolutionMinutes === null ? "—" : `${summaryQuery.data.avgResolutionMinutes} min`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {trendsQuery.data && (
              <div className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h5 card-title">{t("dashboard.slaBreachRate")}</h2>
                    <p className="display-6 fw-bold mb-0">{trendsQuery.data.slaBreachRatePercent}%</p>
                  </div>
                </div>
              </div>
            )}
            {user.role === "Admin" && aiUsageQuery.data && (
              <div className="col">
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h5 card-title">{t("dashboard.aiTrust")}</h2>
                    <p className="display-6 fw-bold mb-0">{aiUsageQuery.data.suggestedReply.usedRatePercent}%</p>
                    <p className="form-text text-muted">{t("dashboard.aiTrustSubtext")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link to="/reports" className="btn btn-outline-primary">{t("dashboard.viewFullReport")}</Link>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the i18n locale files**

In `frontend/src/i18n/locales/en.json`, replace the existing
`"dashboard"` block (`"welcome"`/`"subtitle"`) with:

```json
  "dashboard": {
    "welcome": "Welcome, {{name}}",
    "myTickets": "My Tickets",
    "newTicket": "New Ticket",
    "viewAllMyTickets": "View all my tickets",
    "loading": "Loading…",
    "noTicketsCustomer": "You have no tickets yet.",
    "noTicketsAgent": "No tickets currently assigned to you.",
    "slaAlerts": "SLA alerts",
    "breached": "breached",
    "atRisk": "at risk",
    "avgResolution": "Avg. resolution time",
    "slaBreachRate": "SLA breach rate",
    "aiTrust": "AI trust",
    "aiTrustSubtext": "suggested replies used",
    "viewFullReport": "View full report"
  },
```

(Keep this as a drop-in replacement for the existing `"dashboard"` key
— read the file first to confirm exact surrounding JSON structure/comma
placement before editing, since it sits among many other top-level
keys.)

In `frontend/src/i18n/locales/ar.json`, the current `"dashboard"` block
(lines 24-27 as of this plan's writing) is:

```json
  "dashboard": {
    "welcome": "مرحبًا، {{name}}",
    "subtitle": "ستظهر هنا لوحات التحكم الخاصة بكل دور في المهام القادمة."
  },
```

Replace it with:

```json
  "dashboard": {
    "welcome": "مرحبًا، {{name}}",
    "myTickets": "تذاكري",
    "newTicket": "تذكرة جديدة",
    "viewAllMyTickets": "عرض جميع تذاكري",
    "loading": "جارٍ التحميل…",
    "noTicketsCustomer": "ليس لديك أي تذاكر بعد.",
    "noTicketsAgent": "لا توجد تذاكر مسندة إليك حاليًا.",
    "slaAlerts": "تنبيهات اتفاقية مستوى الخدمة",
    "breached": "متجاوزة",
    "atRisk": "معرضة للخطر",
    "avgResolution": "متوسط وقت الحل",
    "slaBreachRate": "معدل تجاوز اتفاقية مستوى الخدمة",
    "aiTrust": "ثقة الذكاء الاصطناعي",
    "aiTrustSubtext": "الردود المقترحة المستخدمة",
    "viewFullReport": "عرض التقرير الكامل"
  },
```

- [ ] **Step 4: `npx tsc --noEmit` clean, `npm run build` succeeds**

Run `cd frontend && npx tsc --noEmit` and `cd frontend && npm run build`.

- [ ] **Step 5: Live verification across all 4 roles**

Using Playwright (or an equivalent real-browser driver), log in as
each role and confirm:

- **Customer** (with at least one existing ticket, e.g. reuse a
  seeded/existing test customer): "My Tickets" card shows up to 5
  tickets with SLA badges, "New Ticket" button navigates to
  `/tickets/new`. Then check a **fresh Customer with zero tickets**
  (register a new one) sees the empty-state message, not an error or
  blank gap.
- **Agent** (with at least one assigned ticket): "My Tickets" shows
  assigned tickets, breached/at-risk ones sorted first if any exist;
  the SLA-alerts tile's breached+atRisk count matches the same numbers
  the nav badge already shows for that same login. An Agent with zero
  assigned tickets sees the empty-state message.
- **Manager**: stat tiles render; open `/reports` in the same session
  and confirm the numbers match exactly (same `byStatus`/
  `avgResolutionMinutes`/`slaBreachRatePercent` values, since both
  pages call the identical endpoints).
- **Admin**: same as Manager, org-wide, plus the AI-trust tile renders
  a number (not blank/NaN) even if it's `0%` on a fresh dataset.

No console errors in any of the four checks. At 375px width, confirm
no layout overflow on any role's dashboard (this app's established
responsive-design bar from the Bootstrap redesign feature).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardShellPage.tsx frontend/src/i18n/locales/en.json frontend/src/i18n/locales/ar.json
git commit -m "feat: add role-aware home dashboard"
```

---

### Task 2: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/29-home-dashboard.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-058 Done)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Confirm no backend files changed**

Run `git diff --stat <task-1-base-commit>..HEAD -- backend/` (or
equivalent) and confirm it's empty — this is the direct evidence for
the spec's 5th acceptance criterion ("no new backend endpoint or
schema change was introduced").

- [ ] **Step 2: `npx tsc --noEmit` clean, `npm run build` succeeds (re-confirm from a clean state)**

- [ ] **Step 3: Update the spec, verification doc, and implementation plan**

In `29-home-dashboard.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box with genuine
evidence from Task 1 Step 5's live verification (cite specifics — e.g.
"Manager dashboard's `avgResolutionMinutes` and `slaBreachRatePercent`
matched `/reports` exactly for the same login, observed via Playwright").
This project has no automated frontend test suite, so — consistent
with every other frontend-only Round 2/3 feature — this evidence is
live-verification-based, not automated-test-based; say so plainly
rather than implying otherwise.

Add a row to `docs/verification.md`:
`| Role-aware home dashboard (no new backend surface) | Live browser verification across all 4 roles (Customer/Agent ticket widgets incl. empty states, Manager/Admin stat tiles cross-checked against /reports, no console errors, 375px responsive) | PASS |`.

In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-058 in the "Round 3" table and change its status from
`Not Started` to `Done`.

- [ ] **Step 4: Update `features/README.md`'s index**

In `docs/specs/001-customer-support-crm/features/README.md`, update
the sentence added for item 29 (currently says "Not Started as of this
writing") to reflect it's now Done, in the same one-sentence style as
the other Round 2/3 entries.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/29-home-dashboard.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md docs/specs/001-customer-support-crm/features/README.md
git commit -m "docs: mark home dashboard done, record verification"
```
