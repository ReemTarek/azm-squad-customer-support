# Debugging Notes

Root-cause notes for meaningful bugs only (not every trivial fix).
Format: Symptom / Reproduction / Root cause / Fix / How verified.

## Prisma can't reach local SQL Server (P1001) — TASK-001

**Symptom:** `prisma migrate dev` failed with `P1001: Can't reach
database server at localhost:1433`, for both `localhost` and
`127.0.0.1`, with and without an explicit port in `DATABASE_URL`.

**Reproduction:** `Test-NetConnection -ComputerName localhost -Port
1433` returned `TcpTestSucceeded: False`, while `sqlcmd -S localhost -E`
connected fine (proves the SQL Server service itself is up and
reachable via other protocols).

**Root cause:** the local `MSSQLSERVER` instance had the TCP/IP
protocol disabled in `SuperSocketNetLib\Tcp` (`Enabled: 0`), with
`sqlcmd` succeeding via Shared Memory/Named Pipes instead. Prisma's SQL
Server driver (Tiberius) only speaks TCP — no connection-string change
(hostname, port, or omitting the port) can route around a
protocol-level TCP disable at the server.

**Fix attempted:** enabling TCP/IP requires an admin-elevated registry
write (`HKLM:\...\SuperSocketNetLib\Tcp\Enabled = 1`) plus a service
restart — outside what the assistant's tooling can do (not running
elevated), and the user opted not to do this right now.

**Workaround (temporary):** switched `datasource` provider in
`prisma/schema.prisma` from `sqlserver` to `sqlite`, `DATABASE_URL` to
`file:./dev.db`. Verified with a real create+count round trip. See
`docs/decisions.md` for why this is temporary and what has to happen
before submission.

**How verified:** `prisma migrate dev` succeeded against SQLite; a
script created a row and read back a count of 1.

## Gemini suggest-reply returned AI_UNAVAILABLE on every call (TASK-013)

**Symptom:** `POST /tickets/:id/suggest-reply` always returned the
generic 503 `AI_UNAVAILABLE`, even with a valid API key configured.

**Reproduction:** temporarily logged the caught error in the route
handler instead of swallowing it.

**Root cause:** the model name `gemini-2.0-flash` (assumed at design
time) is retired. Google's API returned a 404 with an explicit message
naming the replacement: `models/gemini-2.0-flash is no longer
available ... use models/gemini-3.6-flash`.

**Fix:** updated `GEMINI_MODEL` default and `.env`/`.env.example` to
`gemini-3.6-flash`.

**How verified:** re-ran the same request after restarting the backend
— got a real, contextually relevant draft reply back (correctly
referencing the internal escalation note as context for tone, without
leaking it).

## Page overflowed horizontally at mobile width (TASK-017)

**Symptom:** at a 375px viewport, `document.documentElement.scrollWidth`
was 657px on every authenticated page (dashboard, tickets, customers,
reports) — a horizontal scrollbar on the whole page.

**Reproduction:** Playwright script comparing `scrollWidth` vs
`clientWidth` at 375/768/1440px across the 4 main routes; same 657px
overflow on all 4 pointed at something shared across all of them.

**Root cause:** `.app-header` was a non-wrapping flex row (brand + nav
links + language switcher + user info + logout button); at narrow
widths those items don't fit on one line but had no `flex-wrap`, so
they overflowed instead of wrapping.

**Fix:** added `flex-wrap: wrap` to `.app-header`, `.app-header nav`,
and `.app-header-user`, plus a narrower gap/padding under a 640px media
query. Also wrapped both data tables in an `overflow-x: auto`
container (`min-width: 480px` on the table itself) so a wide table
scrolls internally rather than widening the page.

**How verified:** re-ran the same Playwright check — 0px overflow on
all 12 combinations (4 pages × 3 breakpoints).

## Agent got 403 updating "their" ticket during the demo dry run (TASK-020)

**Symptom:** during the full guaranteed-demo-path run, the agent's
status-update calls silently didn't persist (ticket stayed "Open" in
the DB), and two 403s appeared in the console.

**Reproduction:** replayed the exact PATCH the frontend sent, as the
agent, directly with curl → `403 FORBIDDEN: Only the assigned agent
can update this ticket`.

**Root cause:** not an app bug — a test-data collision. Two agents
both named "Demo Agent" existed (one from an earlier aborted run of
the same script, one from the successful re-run). The assign dropdown
renders `{name}` only, so Playwright's label-based `selectOption`
picked the *first* "Demo Agent" in the DOM — a different user than the
one the script then logged in as. The 403 is the ownership check
working correctly: an agent who isn't actually assigned can't update
the ticket.

**Fix:**
1. Test: select the assign dropdown by agent **id** (from the create
   response) instead of by display name, which isn't guaranteed
   unique.
2. App: the assign dropdown itself had a real latent UX gap — two
   same-named agents would be indistinguishable to a real Admin/Manager
   too. Changed it to render `{name} ({email})`, matching the pattern
   already used in the customer picker.

**How verified:** re-ran the full demo path end-to-end — all 15 steps
passed, ticket status correctly reached "Resolved" and was visible to
the customer, zero console errors.
