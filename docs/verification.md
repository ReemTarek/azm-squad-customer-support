# Verification Matrix

Filled in as each P0 slice is actually exercised — "PASS" is only
written after a real check, not because code exists.

| Feature | Verification | Result |
|---|---|---|
| DB connectivity | Prisma migrate against SQLite (final choice, was originally SQL Server — see decisions.md) | PASS |
| Registration/Login | Register + login via UI (Customer); Admin login via seed | PASS — Playwright screenshots + curl |
| Invalid credentials | Wrong password → 401, no token; UI shows inline error | PASS |
| Missing/expired JWT | Protected route without/malformed/expired token → 401 | PASS — incl. a token signed with expiresIn:-10s |
| Empty search result | Customer search with no matches → empty list, not error | PASS |
| RBAC | Customer token hits Admin-only /api/users → 403; Admin succeeds | PASS |
| Customer creation | UI → API → DB row (SQLite) | PASS — Playwright screenshots |
| Ticket creation | UI → API → DB → visible in agent list | PASS — curl + Playwright |
| Cross-customer record access | Customer requests another customer's ticket/record → 403 | PASS — both /customers and /tickets |
| Internal note isolation | Agent's internal note hidden from Customer | PASS — API and UI, curl + Playwright |
| Status history | Status change recorded and displayed | PASS |
| Manual assignment | Assign → appears on agent dashboard | PASS |
| SLA breach | Backdated ticket shows breached | PASS |
| Unassigned agent blocked | Non-assigned agent PATCHes a ticket → 403 | PASS |
| Customer cannot manage ticket | Customer PATCHes a ticket → 403 | PASS |
| KB visibility | Unpublished hidden from Customer | PASS — curl (list + direct 404) and Playwright |
| Gemini suggest-reply | Real suggestion returned on live ticket | PASS — real Gemini API, curl + Playwright |
| Gemini disabled | No API key → 503, server stays up | PASS |
| Reporting accuracy | Report numbers match manual DB count | PASS — manual Prisma groupBy matched exactly; Agent role blocked (403) |
| Arabic/RTL | Locale switch flips layout + strings | PASS — Playwright, dir flips ltr↔rtl, nav/auth/dashboard/tickets translated |
| Responsive layout | No horizontal overflow at 375/768/1440px | PASS — 12/12 combinations (4 pages × 3 widths), 1 bug found+fixed (header wrap) |
| Validation errors | Bad input on write endpoints → 400 w/ details | PASS — every write endpoint checked, none return 500 |
| Nonexistent resource | GET on a random UUID → 404 | PASS — customers and tickets |
| Duplicate uniqueness | Duplicate email on register/create → 409 | PASS |
| Invalid role assignment | Assign ticket to a Customer (not Agent) → 400 | PASS |
| Full demo path | End-to-end run per demo-walkthrough.md | PASS — all 15 steps via Playwright, 0 console errors |
| Automated test suite | npm test in backend/ — 23 tests | PASS |

## P1

| Feature | Verification | Result |
|---|---|---|
| Ticket tasks/reminders | Create/complete a task, Agent scoping, Customer blocked | PASS — curl + Playwright |
| Quick reply templates | Save, insert into a ticket's reply box, RBAC | PASS — curl + Playwright |
| Automatic assignment | Least-loaded agent picked, cross-checked against manual load count | PASS — curl + Playwright |
| Customer satisfaction | Only after Resolved/Closed, one per ticket, ownership enforced | PASS — curl + Playwright |
| Audit log | Entries written on user/customer/assignment/KB-publish actions, Admin-only UI | PASS — curl + Playwright |
| Richer reports | SLA breach rate + 7-day trend, cross-checked against manual DB query | PASS — curl + Playwright |

## Additional Enhancements (post-P1, from full feature-catalog gap analysis)

| Feature | Verification | Result |
|---|---|---|
| KB search | Filter by title/body/category, empty-state | PASS — curl + Playwright |
| Ticket category | Create/filter/display, default "General" | PASS — curl + Playwright |
| Customer interaction history | Staff-only ticket list on customer detail page | PASS — Playwright, real data |
| Aggregate CSAT + agent performance | Cross-checked against manual DB query | PASS — exact match |
| AI ticket summary | Real Gemini API, coherent contextual output | PASS — curl + Playwright |
| AI-suggested KB articles | Correct match (login→password article) and correct non-match (unrelated ticket) | PASS — both directions verified |
| SLA escalation sweep | Bumps priority to Urgent on breach, writes audit entry, Agent blocked | PASS — curl + Playwright |
| In-app notifications | Breached/at-risk badge, role-scoped | PASS — Playwright |
| P2 notification adapter | Mock email/SMS/WhatsApp behind one interface, real call site on ticket resolution | PASS — isolated script + live audit-log entry |
| P2 ERP adapter | Mock client behind one interface, real call site on customer creation | PASS — isolated script + live 201 response |

## Round 2 — UI redesign

| Feature | Verification | Result |
|---|---|---|
| Bootstrap responsive redesign | Full demo path + 375px/RTL sweep across all pages | PASS |

## Full-system re-verification (2026-08-24, post-enhancements)

A single continuous Playwright run replaying auth, customer+ticket
creation with category, assignment, messaging with internal-note
isolation, AI summary, status transitions, customer feedback,
cross-customer blocking, reports, escalation, KB search, and
Arabic/RTL — **15/15 checks passed** against fresh data. One initial
apparent failure (ticket category not yet visible at assertion time)
was a test-timing artifact, not an app bug — confirmed by a direct
re-check of the same ticket immediately after. The 4 console 403s
logged during this run are the *expected* result of the cross-customer
access-blocked test, not errors.
