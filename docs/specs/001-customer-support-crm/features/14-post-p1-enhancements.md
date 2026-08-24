# Feature Spec: Post-P1 Enhancements (from full feature-catalog gap analysis)

**Requirements:** CRM-KB-002, CRM-TICKET-003, CRM-CUSTOMER-003,
CRM-REPORT-003, CRM-AI-003, CRM-AI-004, CRM-SLA-ESCALATE-001,
CRM-NOTIFY-001, CRM-INTEGRATION-001, CRM-INTEGRATION-002
**Related tasks:** TASK-027 through TASK-036

## Goal

Close the gaps found when the built system was compared against the
user's full product feature catalog (`gap-analysis.md`), scoped to
items that fit the existing architecture without expanding into new
categories (multi-tenancy, chatbot, real providers — see the
discussion docs for those).

## Scope (one line each — full detail already recorded elsewhere)

| Item | What it does | Where it's documented |
|---|---|---|
| KB search | `GET /kb?search=` across title/body/category | `gap-analysis.md` §Progress |
| Ticket category | Free-text field, default "General", filterable | `gap-analysis.md` §Progress |
| Customer interaction history | Staff-only ticket list on customer detail page | `gap-analysis.md` §Progress |
| Aggregate CSAT + agent performance | Rollup stats on the Reports page | `gap-analysis.md` §Progress |
| AI ticket summary | `GET /tickets/:id/summary`, real Gemini call | `gap-analysis.md` §Progress |
| AI-suggested KB articles | `GET /tickets/:id/suggested-articles`, constrained Gemini match | `gap-analysis.md` §Progress |
| SLA escalation sweep | `POST /tickets/escalate-overdue`, bumps priority on breach | `gap-analysis.md` §Progress |
| In-app notifications | Badge on Tickets nav, role-scoped breach/at-risk counts | `gap-analysis.md` §Progress |
| P2 notification adapter | Mock email/SMS/WhatsApp behind one interface | `features/13-integration-adapters.md` |
| P2 ERP adapter | Mock client behind one interface | `features/13-integration-adapters.md` |

## Acceptance criteria

All 10 items verified via curl and/or Playwright, with numeric claims
(CSAT average, agent resolved-counts, SLA breach rate) cross-checked
against manual Prisma queries for an exact match. See
`docs/verification.md` → "Additional Enhancements" table for the full
per-item verification record, and the full-system re-audit entry
(2026-08-24) for the combined end-to-end confirmation.

## Status: Done (all 10 items)
