# AI Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-26

**Goal:** A reporting view showing how much the AI features are
actually used and trusted — suggested-reply shown-vs-used rate,
suggested-article shown-vs-clicked rate, summary-request volume,
chatbot confident-vs-fallback rate — none of which is tracked anywhere
today.

**Architecture:** A new `AiUsageEvent` log table, written to at each
existing Gemini call site (server-observed "shown"/"requested"/
"confident"/"fallback" events) plus a small new endpoint the frontend
calls directly for the two events only the client can observe
("used"/"clicked"). A new aggregate report endpoint reads the table;
a new section on the existing Reports page displays it. Purely
additive instrumentation — no existing AI feature's behavior changes.

**Tech Stack:** Existing Prisma/Express/Vitest+Supertest/React 19+
Vite+TypeScript+Bootstrap 5+React Query stack, no new dependencies.

**Spec:** `docs/specs/001-customer-support-crm/features/27-ai-usage-dashboard.md`

## Global Constraints

- `AiUsageEventType` enum values are the exact snake_case strings from
  the spec (`suggest_reply_shown`, `suggest_reply_used`,
  `summary_requested`, `suggested_articles_shown`,
  `suggested_article_clicked`, `chatbot_confident`,
  `chatbot_fallback`) — this project's schema already has lowercase
  enum-value precedent (`ChatRole`'s `user`/`assistant`), so no
  translation layer between the spec's event names and the DB is
  needed anywhere.
- Every `AiUsageEvent` write is wrapped in its own try/catch, separate
  from the surrounding Gemini call's error handling — a logging
  failure must never turn an otherwise-successful AI response into an
  error, and must never block a request. Same non-fatal
  `console.error(...)`-then-continue isolation pattern already used
  throughout this codebase (notification dispatch, ticket category
  suggestion).
- A `suggest_reply_shown`/`summary_requested`/`suggested_articles_shown`
  event is written ONLY after its Gemini call succeeds — never on a
  caught failure. This is a correctness property (a "shown" event must
  not claim something was shown when it wasn't), not just an
  implementation detail — it gets its own test.
- The new `POST /api/reports/ai-usage/event` endpoint accepts ONLY
  `suggest_reply_used` and `suggested_article_clicked` as valid
  `eventType` values — the other five event types are exclusively
  server-observed and must never be spoofable by a client request
  (a client claiming `chatbot_confident` happened would corrupt the
  report's trust-rate numbers with no way to verify it).
- `GET /api/reports/ai-usage` is gated `Admin`/`Manager`, matching
  `/reports/summary` and `/reports/trends`'s existing role gate.
  `POST /api/reports/ai-usage/event` is gated `Admin`/`Manager`/`Agent`
  — the same roles who can trigger `suggest-reply`/`suggested-articles`
  in the first place.
- No date-range filtering (see spec's correction note — no such
  convention exists elsewhere in `reports.ts` to reuse); ships as an
  all-time aggregate, matching `/summary`'s existing behavior.
- Out of scope: per-agent usage breakdown, cost/token tracking, any
  change to an existing AI feature's own behavior.

---

### Task 1: `AiUsageEvent` schema

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/tests/db.setup.ts`

**Interfaces:**
- Produces: `AiUsageEventType` enum, `AiUsageEvent` model (fields:
  `id`, `eventType`, `ticketId` (nullable), `userId`, `createdAt`),
  consumed by Task 2 (writes) and Task 3 (reads/aggregates).

- [ ] **Step 1: Read the current schema's relevant sections**

Read `backend/prisma/schema.prisma`'s `Ticket` model and `User` model
in full (confirm current field/relation lists match this plan's
excerpts below — both were touched by prior Round 2 features) before
editing either.

- [ ] **Step 2: Add the enum and model**

Add this enum near the other enums at the top of
`backend/prisma/schema.prisma` (alongside `Role`, `Locale`, `ChatRole`,
`LiveChatSessionStatus`, `Priority`, `TicketStatus`):

```prisma
enum AiUsageEventType {
  suggest_reply_shown
  suggest_reply_used
  summary_requested
  suggested_articles_shown
  suggested_article_clicked
  chatbot_confident
  chatbot_fallback
}
```

Add this model near `AuditLog`/`TicketStatusHistory` (the other
event/log-style models):

```prisma
model AiUsageEvent {
  id        String           @id @default(uuid())
  eventType AiUsageEventType
  ticketId  String?
  ticket    Ticket?          @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  createdAt DateTime         @default(now())

  @@index([eventType])
  @@index([ticketId])
  @@index([userId])
  @@index([createdAt])
}
```

- [ ] **Step 3: Add the back-relations**

In the `Ticket` model, add `aiUsageEvents AiUsageEvent[]` alongside
its other back-relations (`messages`, `statusHistory`, `feedback`,
`tasks`) — anywhere in that block, matching the file's existing style.

In the `User` model, add `aiUsageEvents AiUsageEvent[]` alongside its
other back-relations (after `liveChatMessages LiveChatMessage[]` is
fine, matching the file's existing style of appending new relations at
the end of that block).

- [ ] **Step 4: Generate and apply the migration**

Run: `cd backend && npx prisma migrate dev --name add_ai_usage_event`
(check `backend/package.json` and prior migration commit messages if
this exact command differs from established practice — it should
match). Confirm the migration applies cleanly and `npx prisma generate`
regenerates the client without errors. If a stale `npm run dev` or
Prisma Studio process from an earlier session is holding a file lock on
the Prisma engine binary (this has happened repeatedly across this
project's Round 2 work), identify and kill it before retrying — this is
an environmental issue, not a schema problem.

- [ ] **Step 5: Update `resetDb()` in the test DB helper**

In `backend/tests/db.setup.ts`, add `await prisma.aiUsageEvent.deleteMany();`
right after the existing `await prisma.auditLog.deleteMany();` line —
`AiUsageEvent` has an optional cascade-on-delete relation to `Ticket`
(deleted later in this function, at the `ticket.deleteMany()` line) and
a non-cascading relation to `User` (deleted even later), so it must be
cleared before either, matching how `AuditLog` (a similar non-cascading
child of `User`) is already ordered in this function.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all 70 existing tests still pass (schema-only change, no new
tests expected yet).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/tests/db.setup.ts
git commit -m "feat: add AiUsageEvent schema for AI usage tracking"
```

---

### Task 2: Instrument the 4 Gemini call sites

**Files:**
- Modify: `backend/src/routes/tickets.ts`
- Modify: `backend/src/routes/chat.ts`
- Modify: `backend/tests/tickets.test.ts`
- Modify: `backend/tests/smoke.test.ts` (or a new `backend/tests/chat.test.ts` if none exists for chat — check first, see Step 1)

**Interfaces:**
- Consumes: `AiUsageEvent` model from Task 1 (`prisma.aiUsageEvent.create(...)`).
- Produces: nothing new consumed by later tasks directly — Task 3 reads
  the same `AiUsageEvent` table via its own aggregate queries, not
  through any function this task exports.

**Testing approach:** `GEMINI_API_KEY` is unconfigured in this
project's test environment, so `suggestReply`/`summarizeTicket`/
`suggestRelevantArticleIds` always throw, and their three route
handlers already convert that into `Errors.aiUnavailable()` before any
event write is reached. This task's tests therefore verify the
**negative property** for those three routes (a failed call writes no
event) rather than the success path. `answerFromKnowledgeBase` in
`chat.ts` is different: its handler already degrades to
`CHATBOT_FALLBACK_MESSAGE` on any Gemini failure rather than erroring,
so its instrumentation (`chatbot_fallback`) genuinely fires and is
end-to-end testable even with no configured key.

- [ ] **Step 1: Read the current handlers and check for an existing chat test file**

Read `backend/src/routes/tickets.ts`'s `/:id/suggest-reply` (around
line 444), `/:id/summary` (around line 468), and
`/:id/suggested-articles` (around line 492) handlers in full, and
`backend/src/routes/chat.ts` in full (81 lines) — confirm they match
this plan's excerpts below before editing (both may have shifted
slightly since this plan was written; use the confirmed line numbers
only as a starting search point). Check `backend/tests/` for an
existing `chat.test.ts` — if none exists, this task creates one; if one
exists, add to it instead of `smoke.test.ts`.

- [ ] **Step 2: Write the failing tests**

Add these tests to `backend/tests/tickets.test.ts`, inside the
existing `describe("tickets", ...)` block:

```typescript
  it("writes no AiUsageEvent when suggest-reply fails (Gemini unavailable in test env)", async () => {
    const admin = await createUser({ email: "aiusage1@test.com", role: "Admin" });
    const customer = await createUser({ email: "aiusagecust1@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "AI usage test 1", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/suggest-reply`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    const events = await prisma.aiUsageEvent.findMany({ where: { ticketId, eventType: "suggest_reply_shown" } });
    expect(events).toHaveLength(0);
  });

  it("writes no AiUsageEvent when summary fails (Gemini unavailable in test env)", async () => {
    const admin = await createUser({ email: "aiusage2@test.com", role: "Admin" });
    const customer = await createUser({ email: "aiusagecust2@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "AI usage test 2", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/summary`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    const events = await prisma.aiUsageEvent.findMany({ where: { ticketId, eventType: "summary_requested" } });
    expect(events).toHaveLength(0);
  });

  it("writes no AiUsageEvent when suggested-articles fails (Gemini unavailable in test env)", async () => {
    const admin = await createUser({ email: "aiusage3@test.com", role: "Admin" });
    const customer = await createUser({ email: "aiusagecust3@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "AI usage test 3", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/suggested-articles`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    const events = await prisma.aiUsageEvent.findMany({ where: { ticketId, eventType: "suggested_articles_shown" } });
    expect(events).toHaveLength(0);
  });
```

Create `backend/tests/chat.test.ts` (if it doesn't already exist —
confirm from Step 1) with this content, adapting the customer chat
endpoints' exact request/response shape to match what Step 1 found in
the real `chat.ts` (the shapes below match the file as read during
this plan's writing — confirm before trusting verbatim):

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";
import { prisma } from "../src/lib/prisma";

describe("chat AI usage instrumentation", () => {
  it("records a chatbot_fallback event when the chatbot falls back (Gemini unavailable in test env)", async () => {
    const customer = await createUser({ email: "chatai1@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const convRes = await request(app)
      .post("/api/chat/conversations")
      .set("Authorization", `Bearer ${token}`);
    const conversationId = convRes.body.conversation.id;

    const res = await request(app)
      .post(`/api/chat/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "How do I reset my password?" });

    expect(res.status).toBe(201);
    expect(res.body.confident).toBe(false);

    const events = await prisma.aiUsageEvent.findMany({ where: { userId: customer.id } });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("chatbot_fallback");
    expect(events[0].ticketId).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd backend && npm test -- tickets.test.ts chat.test.ts`
Expected: the three `tickets.test.ts` negative-property tests likely
already pass trivially today (no instrumentation code exists yet, so
of course no event is written) — that's fine, they guard a future
regression once Step 4 adds the write. The `chat.test.ts` test should
FAIL (no `AiUsageEvent` row exists yet).

- [ ] **Step 4: Instrument `tickets.ts`'s three AI routes**

In `backend/src/routes/tickets.ts`, in the `/:id/suggest-reply`
handler, change:

```typescript
  try {
    const reply = await suggestReply(
      ticket.subject,
      ticket.priority,
      messages.map((m) => ({ authorRole: m.author.role, body: m.body, isInternalNote: m.isInternalNote }))
    );
    res.json({ reply });
  } catch (err) {
    console.error("Gemini suggest-reply failed:", err);
    throw Errors.aiUnavailable();
  }
```

to:

```typescript
  try {
    const reply = await suggestReply(
      ticket.subject,
      ticket.priority,
      messages.map((m) => ({ authorRole: m.author.role, body: m.body, isInternalNote: m.isInternalNote }))
    );
    try {
      await prisma.aiUsageEvent.create({
        data: { eventType: "suggest_reply_shown", ticketId: id, userId: req.user!.id },
      });
    } catch (logErr) {
      console.error("AI usage event logging failed (non-fatal):", logErr);
    }
    res.json({ reply });
  } catch (err) {
    console.error("Gemini suggest-reply failed:", err);
    throw Errors.aiUnavailable();
  }
```

Apply the same pattern to `/:id/summary` (event type
`"summary_requested"`) and `/:id/suggested-articles` (event type
`"suggested_articles_shown"`), each inserting the inner try/catch
immediately after that route's own Gemini call succeeds and before its
`res.json(...)` line, using the same `id`/`req.user!.id` variables
already in scope in each handler.

- [ ] **Step 5: Instrument `chat.ts`'s chatbot handler**

In `backend/src/routes/chat.ts`, change:

```typescript
  let answerText = CHATBOT_FALLBACK_MESSAGE;
  let confident = false;
  try {
    const result = await answerFromKnowledgeBase(
      body.body,
      priorMessages.map((m) => ({ role: m.role, body: m.body })),
      publishedArticles
    );
    answerText = result.answer;
    confident = result.confident;
  } catch (err) {
    console.error("Chatbot answer failed:", err);
    // Falls back to CHATBOT_FALLBACK_MESSAGE (already set) rather than
    // erroring the request — a chat reply failing shouldn't 503 the
    // whole conversation the way the agent-facing Gemini features do.
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "assistant", body: answerText },
  });
```

to:

```typescript
  let answerText = CHATBOT_FALLBACK_MESSAGE;
  let confident = false;
  try {
    const result = await answerFromKnowledgeBase(
      body.body,
      priorMessages.map((m) => ({ role: m.role, body: m.body })),
      publishedArticles
    );
    answerText = result.answer;
    confident = result.confident;
  } catch (err) {
    console.error("Chatbot answer failed:", err);
    // Falls back to CHATBOT_FALLBACK_MESSAGE (already set) rather than
    // erroring the request — a chat reply failing shouldn't 503 the
    // whole conversation the way the agent-facing Gemini features do.
    // A genuine Gemini failure and an explicit "I don't have a
    // confident answer" model response are both recorded as
    // chatbot_fallback — the spec's event-type list doesn't distinguish
    // them, and both produce the same fallback message to the customer.
  }

  try {
    await prisma.aiUsageEvent.create({
      data: {
        eventType: confident ? "chatbot_confident" : "chatbot_fallback",
        userId: req.user!.id,
      },
    });
  } catch (logErr) {
    console.error("AI usage event logging failed (non-fatal):", logErr);
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "assistant", body: answerText },
  });
```

(`req.user!.id` is already available in this handler via
`assertConversationAccess(conversationId, req.user!.id)` earlier in the
same function — confirm the exact variable name in the real file before
using `req.user!.id` directly, since the existing code passes
`req.user!.id` inline rather than storing it in a local variable.)

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `cd backend && npm test -- tickets.test.ts chat.test.ts`
Expected: all tests pass, including the new ones.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (70 existing + 4 new = 74, or 73 existing +
4 if `chat.test.ts` is genuinely new rather than added to an existing
file — adjust the exact number based on Step 1's finding).

- [ ] **Step 7: Manual real-Gemini verification (optional but recommended)**

If a real `GEMINI_API_KEY` is configured in `backend/.env` (confirmed
present in this environment during a prior Round 2 feature), start the
dev server or use a throwaway `tsx` script calling the route logic
directly, trigger `suggest-reply`/`summary`/`suggested-articles` on a
real ticket, and confirm exactly one matching `AiUsageEvent` row is
created per call via a direct Prisma query. If unavailable, skip and
note it in the report — the negative-property tests plus direct code
reading (the write sits immediately after each Gemini call's success,
structurally identical to the already-tested chatbot path) are the
fallback evidence, matching this project's established convention.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/tickets.ts backend/src/routes/chat.ts backend/tests/tickets.test.ts backend/tests/chat.test.ts
git commit -m "feat: instrument Gemini call sites with AiUsageEvent logging"
```

---

### Task 3: Report + event-recording endpoints

**Files:**
- Modify: `backend/src/routes/reports.ts`
- Create: `backend/src/validation/aiUsage.schema.ts`
- Modify: `backend/tests/tickets.test.ts` or create `backend/tests/reports.test.ts` (this project currently has no `reports.test.ts` — create one; it's the natural home for both new endpoints' tests and any future report tests)

**Interfaces:**
- Produces: `GET /api/reports/ai-usage` (Admin/Manager), `POST /api/reports/ai-usage/event` (Admin/Manager/Agent) — both mounted under the existing `/api/reports` router in `backend/src/app.ts` (no change needed there, since `reports.ts`'s router is already mounted).
- Consumes: `AiUsageEvent` model from Task 1; the events written by Task 2 (for realistic aggregation, though this task's own tests seed rows directly per its testing approach below).

**Testing approach:** the report endpoint's aggregation logic is
tested by seeding `AiUsageEvent` rows directly via
`prisma.aiUsageEvent.createMany(...)` (bypassing Task 2's instrumented
call sites entirely — the report's job is to correctly aggregate
whatever rows exist in the table, independent of how they got there)
and cross-checking the endpoint's JSON response against a manually
computed expectation, satisfying the spec's "verified by direct
comparison against a manual Prisma query" acceptance criterion exactly
and deterministically, with no dependency on Gemini being configured.

- [ ] **Step 1: Read the current `reports.ts` in full**

Read `backend/src/routes/reports.ts` (158 lines) in full — confirm its
current `getOrgScopeWhere` helper, role-gating style, and response
shape conventions match this plan's excerpts before adding to it.

- [ ] **Step 2: Add the request-body validation schema**

Create `backend/src/validation/aiUsage.schema.ts`:

```typescript
import { z } from "zod";

export const recordAiUsageEventSchema = z.object({
  eventType: z.enum(["suggest_reply_used", "suggested_article_clicked"]),
  ticketId: z.string().uuid().optional(),
});
```

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/reports.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";
import { prisma } from "../src/lib/prisma";

describe("reports: AI usage", () => {
  it("records a suggest_reply_used event via the new endpoint", async () => {
    const agent = await createUser({ email: "aiusagepost1@test.com", role: "Agent" });
    const token = tokenFor(agent);

    const res = await request(app)
      .post("/api/reports/ai-usage/event")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "suggest_reply_used" });

    expect(res.status).toBe(201);
    const events = await prisma.aiUsageEvent.findMany({ where: { userId: agent.id, eventType: "suggest_reply_used" } });
    expect(events).toHaveLength(1);
  });

  it("records a suggested_article_clicked event with a ticketId via the new endpoint", async () => {
    const agent = await createUser({ email: "aiusagepost2@test.com", role: "Agent" });
    const customer = await createUser({ email: "aiusagepostcust@test.com", role: "Customer" });
    const token = tokenFor(agent);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "AI usage POST test", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post("/api/reports/ai-usage/event")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "suggested_article_clicked", ticketId });

    expect(res.status).toBe(201);
    const events = await prisma.aiUsageEvent.findMany({ where: { ticketId, eventType: "suggested_article_clicked" } });
    expect(events).toHaveLength(1);
  });

  it("rejects an eventType outside the two client-observable values", async () => {
    const agent = await createUser({ email: "aiusagepost3@test.com", role: "Agent" });
    const token = tokenFor(agent);

    const res = await request(app)
      .post("/api/reports/ai-usage/event")
      .set("Authorization", `Bearer ${token}`)
      .send({ eventType: "chatbot_confident" });

    expect(res.status).toBe(400);
    const events = await prisma.aiUsageEvent.findMany({ where: { userId: agent.id } });
    expect(events).toHaveLength(0);
  });

  it("returns accurate aggregate counts and rates, verified against a manual Prisma query", async () => {
    const admin = await createUser({ email: "aiusagereport1@test.com", role: "Admin" });
    const agent = await createUser({ email: "aiusagereportagent@test.com", role: "Agent" });
    const adminToken = tokenFor(admin);

    // Seed a known, deliberately-uneven distribution directly — this
    // report's job is to aggregate the table correctly, independent of
    // how rows got there.
    await prisma.aiUsageEvent.createMany({
      data: [
        { eventType: "suggest_reply_shown", userId: agent.id },
        { eventType: "suggest_reply_shown", userId: agent.id },
        { eventType: "suggest_reply_shown", userId: agent.id },
        { eventType: "suggest_reply_used", userId: agent.id },
        { eventType: "suggested_articles_shown", userId: agent.id },
        { eventType: "suggested_articles_shown", userId: agent.id },
        { eventType: "suggested_article_clicked", userId: agent.id },
        { eventType: "suggested_article_clicked", userId: agent.id },
        { eventType: "summary_requested", userId: agent.id },
        { eventType: "summary_requested", userId: agent.id },
        { eventType: "summary_requested", userId: agent.id },
        { eventType: "summary_requested", userId: agent.id },
        { eventType: "chatbot_confident", userId: agent.id },
        { eventType: "chatbot_confident", userId: agent.id },
        { eventType: "chatbot_confident", userId: agent.id },
        { eventType: "chatbot_fallback", userId: agent.id },
      ],
    });

    const res = await request(app)
      .get("/api/reports/ai-usage")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Manual cross-check via an independent Prisma query, per the
    // spec's own required verification rigor.
    const manualCounts = await prisma.aiUsageEvent.groupBy({ by: ["eventType"], _count: { _all: true } });
    const countOf = (type: string) => manualCounts.find((c) => c.eventType === type)?._count._all ?? 0;

    expect(res.body.suggestedReply.shown).toBe(countOf("suggest_reply_shown"));
    expect(res.body.suggestedReply.used).toBe(countOf("suggest_reply_used"));
    expect(res.body.suggestedReply.shown).toBe(3);
    expect(res.body.suggestedReply.used).toBe(1);
    expect(res.body.suggestedReply.usedRatePercent).toBe(33);

    expect(res.body.suggestedArticles.shown).toBe(2);
    expect(res.body.suggestedArticles.clicked).toBe(2);
    expect(res.body.suggestedArticles.clickRatePercent).toBe(100);

    expect(res.body.summaryRequests).toBe(4);

    expect(res.body.chatbot.confident).toBe(3);
    expect(res.body.chatbot.fallback).toBe(1);
    expect(res.body.chatbot.confidentRatePercent).toBe(75);
  });

  it("returns zero/null rates cleanly with no events (division-by-zero guard)", async () => {
    const admin = await createUser({ email: "aiusagereport2@test.com", role: "Admin" });
    const adminToken = tokenFor(admin);

    const res = await request(app)
      .get("/api/reports/ai-usage")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.suggestedReply.shown).toBe(0);
    expect(res.body.suggestedReply.usedRatePercent).toBe(0);
    expect(res.body.chatbot.confidentRatePercent).toBe(0);
  });

  it("hides the AI usage report from Agents", async () => {
    const agent = await createUser({ email: "aiusagereportagent2@test.com", role: "Agent" });
    const agentToken = tokenFor(agent);

    const res = await request(app)
      .get("/api/reports/ai-usage")
      .set("Authorization", `Bearer ${agentToken}`);

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `cd backend && npm test -- reports.test.ts`
Expected: all FAIL or error — neither endpoint exists yet.

- [ ] **Step 5: Add both endpoints to `reports.ts`**

In `backend/src/routes/reports.ts`, add this import at the top
alongside the existing ones:

```typescript
import { recordAiUsageEventSchema } from "../validation/aiUsage.schema";
```

Add these two routes, after the existing `/trends` handler and before
`export default router;`:

```typescript
router.post("/ai-usage/event", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const body = recordAiUsageEventSchema.parse(req.body);
  const event = await prisma.aiUsageEvent.create({
    data: { eventType: body.eventType, ticketId: body.ticketId, userId: req.user!.id },
  });
  res.status(201).json({ event });
});

router.get("/ai-usage", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const counts = await prisma.aiUsageEvent.groupBy({ by: ["eventType"], _count: { _all: true } });
  const countOf = (type: string) => counts.find((c) => c.eventType === type)?._count._all ?? 0;

  const replyShown = countOf("suggest_reply_shown");
  const replyUsed = countOf("suggest_reply_used");
  const articlesShown = countOf("suggested_articles_shown");
  const articlesClicked = countOf("suggested_article_clicked");
  const chatbotConfident = countOf("chatbot_confident");
  const chatbotFallback = countOf("chatbot_fallback");
  const chatbotTotal = chatbotConfident + chatbotFallback;

  res.json({
    suggestedReply: {
      shown: replyShown,
      used: replyUsed,
      usedRatePercent: replyShown === 0 ? 0 : Math.round((replyUsed / replyShown) * 100),
    },
    suggestedArticles: {
      shown: articlesShown,
      clicked: articlesClicked,
      clickRatePercent: articlesShown === 0 ? 0 : Math.round((articlesClicked / articlesShown) * 100),
    },
    summaryRequests: countOf("summary_requested"),
    chatbot: {
      confident: chatbotConfident,
      fallback: chatbotFallback,
      confidentRatePercent: chatbotTotal === 0 ? 0 : Math.round((chatbotConfident / chatbotTotal) * 100),
    },
  });
});
```

Both routes are intentionally NOT org-scoped via `getOrgScopeWhere`
(unlike `/summary`/`/trends`) — `AiUsageEvent` has no
department/branch of its own, and per the spec this version is an
org-wide aggregate only (per-agent/per-department breakdown is
explicitly out of scope).

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `cd backend && npm test -- reports.test.ts`
Expected: all tests pass.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/reports.ts backend/src/validation/aiUsage.schema.ts backend/tests/reports.test.ts
git commit -m "feat: add AI usage report and event-recording endpoints"
```

---

### Task 4: Frontend — Reports page section and event-firing hooks

**Files:**
- Modify: `frontend/src/lib/reportsApi.ts`
- Modify: `frontend/src/pages/ReportsPage.tsx`
- Modify: `frontend/src/pages/tickets/TicketDetailPage.tsx`

**Interfaces:**
- Consumes: `GET /api/reports/ai-usage`, `POST /api/reports/ai-usage/event`
  from Task 3.

- [ ] **Step 1: Read the current files in full**

Read `frontend/src/lib/reportsApi.ts` (29 lines), `frontend/src/pages/ReportsPage.tsx`
(152 lines), and `frontend/src/pages/tickets/TicketDetailPage.tsx`'s
`suggestMutation`, `suggestedArticlesMutation`, `messageMutation`
definitions and the suggested-articles rendering block (confirm these
match this plan's excerpts, since this file is large and has been
touched by several prior features).

- [ ] **Step 2: Extend `reportsApi.ts`**

Add to `frontend/src/lib/reportsApi.ts`:

```typescript
export interface AiUsageReport {
  suggestedReply: { shown: number; used: number; usedRatePercent: number };
  suggestedArticles: { shown: number; clicked: number; clickRatePercent: number };
  summaryRequests: number;
  chatbot: { confident: number; fallback: number; confidentRatePercent: number };
}

export async function getAiUsageReport() {
  const { data } = await apiClient.get<AiUsageReport>("/reports/ai-usage");
  return data;
}

export type AiUsageEventType = "suggest_reply_used" | "suggested_article_clicked";

export async function recordAiUsageEvent(eventType: AiUsageEventType, ticketId?: string) {
  await apiClient.post("/reports/ai-usage/event", { eventType, ticketId });
}
```

- [ ] **Step 3: Add the "AI Usage" section to `ReportsPage.tsx`**

In `frontend/src/pages/ReportsPage.tsx`, add the import:

```typescript
import { getReportsSummary, getReportsTrends, getAiUsageReport } from "../lib/reportsApi";
```

Add a new query alongside the existing two:

```typescript
  const aiUsageQuery = useQuery({ queryKey: ["reports-ai-usage"], queryFn: getAiUsageReport });
```

Add a new full-width section after the existing trend-bars `<section>`
(before the closing `</div>` of the page), following the same
`card card-body` container style already used for that section:

```tsx
      {aiUsageQuery.data && (
        <section className="card card-body mt-3">
          <h2>AI Usage</h2>
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3">
            <div className="col">
              <h3 className="h6">Suggested replies</h3>
              <p className="mb-0">{aiUsageQuery.data.suggestedReply.used} used / {aiUsageQuery.data.suggestedReply.shown} shown</p>
              <p className="form-text text-muted">{aiUsageQuery.data.suggestedReply.usedRatePercent}% used</p>
            </div>
            <div className="col">
              <h3 className="h6">Suggested articles</h3>
              <p className="mb-0">{aiUsageQuery.data.suggestedArticles.clicked} clicked / {aiUsageQuery.data.suggestedArticles.shown} shown</p>
              <p className="form-text text-muted">{aiUsageQuery.data.suggestedArticles.clickRatePercent}% clicked</p>
            </div>
            <div className="col">
              <h3 className="h6">Ticket summaries</h3>
              <p className="mb-0">{aiUsageQuery.data.summaryRequests} requested</p>
            </div>
            <div className="col">
              <h3 className="h6">Chatbot confidence</h3>
              <p className="mb-0">{aiUsageQuery.data.chatbot.confident} confident / {aiUsageQuery.data.chatbot.fallback} fallback</p>
              <p className="form-text text-muted">{aiUsageQuery.data.chatbot.confidentRatePercent}% confident</p>
            </div>
          </div>
        </section>
      )}
```

- [ ] **Step 4: Fire `suggest_reply_used` on send in `TicketDetailPage.tsx`**

Add the import:

```typescript
import { recordAiUsageEvent } from "../../lib/reportsApi";
```

Add new state near the other `useState` calls in the component:

```typescript
  const [wasAiSuggestedReply, setWasAiSuggestedReply] = useState(false);
```

Change the `suggestMutation`'s `onSuccess`:

```typescript
  const suggestMutation = useMutation({
    mutationFn: () => suggestReply(id!),
    onSuccess: (reply) => {
      setReplyBody(reply);
      setWasAiSuggestedReply(true);
    },
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });
```

Change the `messageMutation`'s `onSuccess`:

```typescript
  const messageMutation = useMutation({
    mutationFn: () => postMessage(id!, { body: replyBody, isInternalNote, file: replyFile ?? undefined }),
    onSuccess: () => {
      if (wasAiSuggestedReply) {
        recordAiUsageEvent("suggest_reply_used", id).catch((err) => console.error("AI usage event logging failed (non-fatal):", err));
      }
      setWasAiSuggestedReply(false);
      setReplyBody("");
      setIsInternalNote(false);
      setReplyFile(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", id, "messages"] });
    },
    onError: (err) => setActionError(extractApiErrorMessage(err)),
  });
```

This fires `suggest_reply_used` whenever a reply that was populated by
the AI suggestion is sent — including if the agent edited the text
afterward, per the spec's "edited or not" requirement, since editing
`replyBody` doesn't touch `wasAiSuggestedReply`. Discarding the draft
(navigating away, clearing the field without sending) never sends the
event, since it only fires inside `messageMutation`'s `onSuccess`. The
flag resets after every send (successful or not attempted again) so a
later, manually-typed reply in the same session doesn't spuriously
record a used-AI-suggestion event.

- [ ] **Step 5: Fire `suggested_article_clicked` on click-through**

In the suggested-articles list rendering, change:

```tsx
                <li key={a.id}><Link to={`/kb/${a.id}`}>{a.title}</Link> ({a.category})</li>
```

to:

```tsx
                <li key={a.id}>
                  <Link
                    to={`/kb/${a.id}`}
                    onClick={() => recordAiUsageEvent("suggested_article_clicked", id).catch((err) => console.error("AI usage event logging failed (non-fatal):", err))}
                  >
                    {a.title}
                  </Link> ({a.category})
                </li>
```

`onClick` on a React Router `<Link>` does not prevent the navigation
unless `preventDefault()` is called (it isn't here), so this fires the
tracking call and lets the click-through proceed normally in the same
tick.

- [ ] **Step 6: `npx tsc --noEmit` in `frontend/` is clean, then `npm run build` succeeds**

- [ ] **Step 7: Manual browser verification**

Start both dev servers. As an Admin/Manager, open Reports and confirm
the new "AI Usage" section renders (0/0 with a fresh DB is fine). As an
Agent on a ticket, click "Suggest Articles", click through to one of
the results, then reload Reports as an Admin and confirm the clicked
count incremented by exactly one. If a real `GEMINI_API_KEY` is
configured, also try "Suggest Reply" → send it (edited or not) and
confirm the used count increments; otherwise note that this half of
the manual check was skipped due to no configured key, consistent with
Task 2's own verification note.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/reportsApi.ts frontend/src/pages/ReportsPage.tsx frontend/src/pages/tickets/TicketDetailPage.tsx
git commit -m "feat: add AI Usage section to Reports page and wire up event tracking"
```

---

### Task 5: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/27-ai-usage-dashboard.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-056 Done)
- Modify: `docs/specs/001-customer-support-crm/features/README.md` (index entry)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all tests pass (exact count depends on Tasks 2-3's final
test additions — confirm and report the real number).

- [ ] **Step 2: `npx tsc --noEmit` clean in both `backend/` and `frontend/`; `npm run build` succeeds in `frontend/`**

- [ ] **Step 3: Update the spec, verification doc, implementation plan, and features index**

In `27-ai-usage-dashboard.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box with genuine
evidence, following this project's established honesty convention —
in particular, be explicit that the three ticket-route "shown"/
"requested" success-path writes are verified by direct code reading
(plus a manual real-Gemini check if performed) rather than an
automated end-to-end HTTP test, per this plan's own testing-approach
note. The second criterion ("sending an AI-drafted reply records
`suggest_reply_used`; discarding it records nothing further") is
frontend behavioral logic — this project has no automated frontend
test suite (every prior Round 2 frontend feature was verified live via
Playwright/manual browser check, not an automated frontend test), so
this criterion's evidence is Task 4 Step 7's manual browser
verification, not an automated test; check the box only if that
verification was genuinely performed and observed to work, citing it
explicitly rather than implying automated coverage that doesn't exist.

Add a row to `docs/verification.md`:
`| AI usage dashboard (event logging + aggregate report) | Automated tests (aggregation cross-check, negative on-failure property, chatbot fallback path, event-recording endpoint) + [real-Gemini check if performed] | PASS |`.

In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-056 in the "Round 2" table and change its status from
`Not Started` to `Done`.

In `docs/specs/001-customer-support-crm/features/README.md`, add one
sentence for item 27 in the same style as items 20-23/26, and update
whatever "remain Not Started" language currently covers 27/28 so only
28 (custom branding) is left.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/27-ai-usage-dashboard.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md docs/specs/001-customer-support-crm/features/README.md
git commit -m "docs: mark AI usage dashboard done, record verification"
```
