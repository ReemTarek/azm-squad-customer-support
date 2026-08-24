# Gap Analysis — Full Feature Catalog vs. Built State

The user supplied a complete product feature catalog (12 categories).
This maps it against what's actually built and verified (P0+P1, done
2026-08-24), so priorities for further work are based on real gaps,
not guesswork.

Legend: ✅ built & verified · ⚠️ partially built · ❌ not built

## 1. Customer Management
- ✅ Customer profiles, contact details (phone/company)
- ❌ Interaction history view (customer detail page shows the profile
  form, not a list of their tickets/messages)
- ❌ Notes and attachments (no notes field, no file upload anywhere)

## 2. Ticket Management
- ✅ Create/track, assign (manual + automatic), status + full history
- ⚠️ Priorities ✅, but **no category field** on tickets (KB articles
  have categories, tickets don't)
- ❌ Escalation (no auto-escalation on SLA breach — SLA state is
  visible, but nothing acts on it)

## 3. Communication Channels
- ❌ Email, WhatsApp, SMS — explicitly P2 in the original brief (no
  credentials; brief says build adapter interfaces, not real
  integrations)
- ❌ Live chat — explicitly flagged P2 anti-pattern in the original
  brief ("sophisticated real-time chat infrastructure")
- ⚠️ Web forms — the ticket-creation form itself covers this

## 4. Agent Dashboard
- ✅ Assigned tickets, tasks/reminders, quick replies
- ⚠️ Customer information — reachable via a ticket, not a dedicated
  dashboard widget
- ❌ Team collaboration beyond internal notes (no @mentions, no
  agent-to-agent messaging outside a ticket thread)

## 5. SLA & Automation
- ✅ Response/resolution targets, automatic assignment
- ❌ Escalation rules (nothing changes automatically on breach)
- ❌ Alerts/notifications (no in-app or external notification system
  at all — SLA state is pull, not push)

## 6. Knowledge Base
- ✅ Articles, categories, publish gating
- ❌ **Search** — the KB list has no search box (customers list does)

## 7. AI Features
- ✅ Suggested replies (real Gemini)
- ❌ Ticket summaries, automatic categorization, suggested KB
  solutions, AI chatbot — none built. All would extend the existing
  `services/gemini.ts` pattern; chatbot specifically overlaps the P2
  "real-time chat" anti-pattern from the original brief.

## 8. Customer Portal
- ✅ Submit, track, view history, browse KB, submit feedback — fully
  done (P0 TASK-014 + P1 TASK-024)

## 9. Reports & Management
- ✅ Ticket counts, SLA breach rate + trend, tickets-per-agent
- ❌ Agent performance (no per-agent resolution-time/quality metric)
- ❌ Aggregate customer satisfaction score (individual ratings are
  captured — TASK-024 — but never rolled up into a report)

## 10. Security & Administration
- ✅ Users/roles/permissions (RBAC), audit log
- ❌ System configuration panel (SLA thresholds are a hardcoded
  constant map, not admin-editable)

## 11. Integrations
- ⚠️ "APIs" — the REST API itself is the integration surface
- ❌ ERP, Email/SMS/WhatsApp, other external systems — P2, no
  credentials, not started (per original brief's own guidance: adapter
  interfaces only, not real providers)

## 12. Platform
- ✅ Arabic/English + RTL (core screens), responsive layout
- ❌ Multi-department, multi-branch, custom branding — **not in the
  original P0/P1 scope at all**; each implies real schema/tenancy
  changes across most entities, not a small addition

## Progress (2026-08-24)

Small high-value fixes: **Done**, all verified via curl + Playwright:
- KB search (`GET /kb?search=`, search box on KB list)
- Ticket category field (schema + create/update/filter + UI)
- Customer interaction-history view (staff-only "Ticket History"
  section on the customer detail page)
- Aggregate CSAT + agent-performance report cards (`GET
  /reports/trends` extended, cross-checked against manual DB queries)

## Recommendation

Small, high-value, low-risk additions (fit the existing architecture,
no new scope categories):
1. KB search box
2. Ticket category field
3. Customer interaction-history view
4. Aggregate CSAT + agent performance report cards
5. AI ticket summary + AI-suggested KB article (extends existing
   Gemini service, same pattern as suggested replies)

Medium effort, still in-scope:
6. SLA escalation rule (e.g. auto-flag/reassign on breach) + a basic
   in-app alert/notification
7. Admin-editable SLA configuration (replace the hardcoded map)
8. Customer notes (text only — file attachments are materially more
   work: storage, size limits, virus/type validation)

P2, adapters only (per original brief — do not build real providers):
9. Email/SMS/WhatsApp notification adapter interface
10. ERP adapter interface

Recommend explicitly **not** building without further discussion:
multi-department, multi-branch, custom branding, AI chatbot, real
communication providers — each is a scope category the original P0/P1
plan never included, and several (chatbot, live chat, multi-tenancy)
are exactly what the brief's own P2 guidance warns against
over-investing in.
