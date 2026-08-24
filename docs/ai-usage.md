# AI Usage Log

Meaningful examples of where AI (Claude) influenced implementation
decisions, and how the output was verified before acceptance. Not a
transcript dump — only entries that show a real decision point.

## Backend stack selection

### AI suggestion
Presented Express+Prisma vs NestJS vs .NET/EF Core for the API layer,
recommending Express+Prisma for a solo 3-day build.

### Review
Checked Prisma's SQL Server provider maturity and that Express gives
enough structure (routes/services/middleware) without Nest's DI
ceremony for a project this size.

### Decision
Accepted.

### Reason
Least ceremony for the deadline; user already leaning Node/TS.

### Verification
To be confirmed once the backend boots and Prisma successfully
migrates against the real SQL Server instance (TASK-001).

## SLA computation strategy

### AI suggestion
Compute SLA due timestamps at write time (ticket create/priority
change) and derive on_track/at_risk/breached state at read time,
instead of a scheduled job that periodically flags tickets.

### Review
Checked against the brief's explicit instruction not to build infra
automation (cron/worker) for what should be a lightweight P0 feature,
and confirmed compute-on-read still produces a real, testable SLA
state without a background process.

### Decision
Accepted.

### Reason
Simpler to build and verify in the time available; no missed-tick or
worker-crash failure mode to handle.

### Verification
Planned: backdate a ticket's `createdAt` directly in SQL Server and
confirm the API reports `breached` (TASK-010 verification step).

## SQL Server auth: Windows Authentication risk flagged early

### AI suggestion
Flagged that Prisma's SQL Server driver (Tiberius under the hood) has
had inconsistent support for integrated/Windows security across
versions, and proposed a dedicated first task (TASK-001) to verify
connectivity before any other backend work depends on it, with a
SQL-auth fallback plan.

### Review
This is a claim about a specific library's behavior that needs
hands-on confirmation, not a re-derivation from docs already read —
tracked as an explicit spike task rather than assumed to work.

### Decision
Accepted (as a verify-first task, not a blind assumption).

### Reason
A wrong assumption here would silently block every other backend task;
cheaper to find out on day 1, task 1.

### Verification
TASK-001 executed: local SQL Server had TCP/IP disabled at the
protocol level (not an auth issue as originally guessed). Documented
in `docs/debugging-notes.md`; SQLite substituted temporarily per
`docs/decisions.md`.

## Gemini suggested-reply integration

### AI suggestion
Implement `services/gemini.ts` calling `@google/generative-ai` with a
prompt built from the ticket subject, priority, and full message
thread (including internal notes, since the draft is agent-facing and
editable before send — internal notes give the model useful context
without ever being shown to the customer).

### Review
Checked: the endpoint is Agent/Manager/Admin only (not Customer), the
internal-note content never leaves the server response as anything
other than input to the model, and failures are caught and surfaced as
503 `AI_UNAVAILABLE` rather than a raw 500.

### Decision
Accepted, then corrected once: the first real API call returned a 404
because the assumed model name (`gemini-2.0-flash`) had been retired.
The API's own error message named the current replacement
(`gemini-3.6-flash`), which was substituted in.

### Reason
Server-side logging of the caught error (instead of only swallowing it
into a generic 503) was what surfaced the real cause quickly — see
`docs/debugging-notes.md`.

### Verification
Re-tested against the live API after the model-name fix: got a real,
contextually relevant draft reply referencing the actual ticket
content. Also verified the failure path by temporarily blanking
`GEMINI_API_KEY` — clean 503, server stayed healthy.
