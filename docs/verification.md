# Verification Matrix

Filled in as each P0 slice is actually exercised — "PASS" is only
written after a real check, not because code exists.

| Feature | Verification | Result |
|---|---|---|
| DB connectivity (Windows Auth) | Prisma migrate against real SQL Server | Pending |
| Registration/Login | Register + login via UI for each role | Pending |
| Invalid credentials | Wrong password → 401, no token | Pending |
| Missing/expired JWT | Protected route without/with expired token → 401 | Pending |
| RBAC | Agent hits Admin-only route → 403 | Pending |
| Customer creation | UI → API → SQL Server row | Pending |
| Ticket creation | UI → API → DB → visible in agent list | Pending |
| Cross-customer ticket access | Customer requests another customer's ticket → 403 | Pending |
| Internal note isolation | Agent's internal note hidden from Customer | Pending |
| Status history | Status change recorded and displayed | Pending |
| Manual assignment | Assign → appears on agent dashboard | Pending |
| SLA breach | Backdated ticket shows breached | Pending |
| KB visibility | Unpublished hidden from Customer | Pending |
| Gemini suggest-reply | Real suggestion returned on live ticket | Pending |
| Gemini disabled | No API key → 503, server stays up | Pending |
| Reporting accuracy | Report numbers match manual DB count | Pending |
| Arabic/RTL | Locale switch flips layout + strings | Pending |
| Validation errors | Bad input on write endpoints → 400 w/ details | Pending |
| Full demo path | End-to-end run per demo-walkthrough.md | Pending |
