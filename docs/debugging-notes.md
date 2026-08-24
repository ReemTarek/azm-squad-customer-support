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
