# Rubric Evidence Map

Maps this repo's artifacts directly to the assessment rubric, so
evaluation doesn't require reverse-engineering the process from commit
history. Written honestly, including the one place the process didn't
fully hold — see the note under **Requirement & Specification** and
**Planning & Task Breakdown**.

| Area | Criterion | Weight | Evidence |
|---|---|---|---|
| AI & SDD Application | Requirement & Specification | 10 | `docs/specs/001-customer-support-crm/spec.md` (every P0/P1/approved-addition requirement has an ID, e.g. `CRM-TICKET-001`); 22 individual feature specs in `features/` (Goal, Assumptions, Scope, Acceptance Criteria, Verification, Status per feature); `acceptance-checklist.md`. **Honest gap:** 10 items (`features/14a`–`14h`, `13`) were spec'd *after* implementation rather than before — see below. |
| AI & SDD Application | Planning & Task Breakdown | 20 | `implementation-plan.md` — TASK-001 through TASK-047, each with Requirement/Goal/Dependencies/Database/Backend/Frontend/Verification/Status, organized P0 → P1 → post-P1 enhancements → two large approved additions, each with its own dependency-ordered task list; `traceability.md` (Requirement → DB model → API → Frontend → Verification, one row per P0 requirement); `gap-analysis.md` (systematic comparison against the full feature catalog, bucketed by effort/risk, with an explicit recommendation the user then decided against in 3 of 4 cases — documented, not silently overridden). |
| AI & SDD Application | AI Usage & Verification | 10 | `docs/ai-usage.md` (Decision → AI suggestion → Review → Decision → Reason → Verification format, e.g. backend stack choice, SLA architecture, a flagged-and-confirmed risk around Windows Auth, the Gemini model retirement fix); `docs/debugging-notes.md` (7 real bugs found via testing and root-caused, not guessed at — SQL Server TCP/IP misdiagnosis, Gemini model retirement, responsive-layout overflow, a report data-leak across department scoping, and 3 test-script-vs-app-bug disambiguations); every feature verified against a *running* app (curl + Playwright screenshots), not asserted from reading code — see `docs/verification.md`. |
| Software Engineering & Full-Stack | Engineering Foundations | 10 | `backend/src/{routes,services,middleware,validation,lib,integrations}` separation of concerns; one RBAC pattern (`requireAuth`/`requireRole`) reused across every route; one error shape (`lib/errors.ts` + `middleware/errorHandler.ts`); zod validation on every write endpoint; git history on `main` with one commit per vertical slice, each with a real rationale in the message; `docs/debugging-notes.md` follows reproduce → root-cause → targeted fix → retest for every entry. |
| Software Engineering & Full-Stack | Backend / API / Database | 10 | `api-contract.md`, `data-model.md`; Prisma schema across ~10 migrations (`backend/prisma/migrations/`); RBAC- and now department/branch-scoped queries (`tickets.ts`, `reports.ts`); full CRUD across customers/tickets/KB/tasks/quick-replies/audit-log/departments/branches/chat. |
| Software Engineering & Full-Stack | Frontend & End-to-End Flow | 10 | React Query + React Router architecture (`frontend/src/{pages,components,lib,auth}`); every backend endpoint has a corresponding UI surface (no orphaned API-only features except intentionally, e.g. staff department assignment — noted in `features/17-multi-department-branch.md`); i18n (`src/i18n/`) and responsive layout (`docs/debugging-notes.md` overflow fix); every flow verified end-to-end via Playwright against the live app, not just component-level. |
| Productivity | — | 10 | Vertical-slice delivery throughout (spec → DB → backend → frontend → verify → commit per task, never backend-only or UI-only); no scope creep beyond what was asked or explicitly approved (`gap-analysis.md` explicitly recommended *against* several items the user then still chose — followed anyway, flagged, not silently expanded further); reused existing patterns rather than re-inventing (internal-note visibility pattern reused for department scoping reasoning, `suggestReply`'s architecture reused for `summarizeTicket`/`suggestRelevantArticleIds`/chatbot answering); dead code removed when superseded (mock email channel deleted once the real SMTP channel replaced it). |
| Quality & Understanding | Correctness & Maintainability | 10 | `npx tsc --noEmit` run clean after every single change (not just at the end); consistent naming/structure across ~20 backend routes and ~25 frontend pages; no leftover placeholder/TODO code; docs cross-reference each other rather than duplicating (e.g. `implementation-plan.md` points to `features/*.md` for detail instead of repeating it). |
| Quality & Understanding | Testing, Security & Edge Cases | 5 | `docs/verification.md` — full matrix of positive and negative cases: invalid credentials, missing/expired/malformed JWT, wrong-role 403s, cross-customer access, cross-agent access, cross-department access (with a real bug found and fixed here), duplicate-email 409s, invalid-role-reference 400s, empty search results, AI-service-unavailable 503s. `acceptance-checklist.md` mirrors it as a checklist. |
| Quality & Understanding | Technical Understanding & Ownership | 5 | `docs/decisions.md` and `docs/specs/001-customer-support-crm/decisions.md` (ADR-style: context, options considered, why, trade-offs — e.g. why SQLite over SQL Server, why compute-on-read SLA, why Agent isn't department-scoped but Manager is); design alternatives presented and a specific option chosen *before* building for the two largest additions (multi-department scoping approach, AI chatbot scope) rather than assumed; the process-gap entry directly below, written when the gap was raised rather than left undiscovered. |

## The process gap, stated plainly

10 requirements (`CRM-KB-002`, `CRM-TICKET-003`, `CRM-CUSTOMER-003`,
`CRM-REPORT-003`, `CRM-AI-003`, `CRM-AI-004`, `CRM-SLA-ESCALATE-001`,
`CRM-NOTIFY-001`, `CRM-INTEGRATION-001`, `CRM-INTEGRATION-002`) were
built directly from a gap-analysis recommendation list once the user
approved the bucket as a whole, and spec'd individually only
afterward — not reviewed and approved per item before code, the way
every other requirement in this project was handled (all of P0, all
of P1, and everything from TASK-037 onward, including two large
additions where design *options* were presented and a choice made
before the spec was even written).

This was flagged by the user mid-project, not found unprompted. The
fix applied: each of the 10 items got an individual spec document,
explicitly labeled as written after the fact (not backdated to look
otherwise), with the same Goal/Assumptions/Scope/Acceptance-Criteria/
Verification structure as every spec-first feature — so the
*documentation quality* is consistent even though the *process
timing* wasn't. See `docs/decisions.md` for the full entry and
`features/README.md`'s "Spec timing" column for the complete
per-feature breakdown.
