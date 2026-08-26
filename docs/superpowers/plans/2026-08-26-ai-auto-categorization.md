# AI Automatic Ticket Categorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-26

**Goal:** Have Gemini suggest a ticket's category at creation time, so
customers (who almost never override the default) don't leave every
ticket as `"General"` — grounded only in categories already in use
elsewhere in the system, never an invented new one.

**Architecture:** One new function in the existing Gemini service
(`suggestTicketCategory`) plus one addition to `POST /api/tickets`: after
creating a ticket whose category is still the default `"General"`, look
up the distinct non-`"General"` categories already in use, ask Gemini to
pick one (or stick with `"General"`), and update the ticket if it picked
something real. Wrapped in try/catch so a Gemini failure never breaks
ticket creation. No schema change, no new files, no new route.

**Tech Stack:** Existing Prisma/Express/Vitest+Supertest/Google Generative
AI SDK stack, no new dependencies.

**Spec:** `docs/specs/001-customer-support-crm/features/26-ai-auto-categorization.md`

## Global Constraints

- Only runs when the ticket's category, after Zod's default-fill, is
  exactly `"General"` — an explicit non-default category from the
  customer is respected and the AI call is skipped entirely.
- Never blocks or fails ticket creation — any Gemini error (unconfigured
  key, quota, network) is caught and the ticket keeps category
  `"General"`, logged but not surfaced to the customer. Same
  `.catch((err) => console.error(...))` isolation pattern already used
  for the resolved/closed and new-message notification call sites in
  this same file.
- The AI is only ever allowed to return a category that already exists
  somewhere in the system (queried fresh at call time) or `"General"` —
  it can never invent a brand-new category. Validate the model's raw
  text output against the real set before trusting it, exactly like
  `suggestRelevantArticleIds`'s existing id-validation guard.
- Out of scope: re-categorizing existing tickets in bulk, any frontend/UI
  change (the category field displays exactly as it does today).

---

### Task 1: Add `suggestTicketCategory` and wire it into ticket creation

**Files:**
- Modify: `backend/src/services/gemini.ts`
- Modify: `backend/src/routes/tickets.ts`
- Modify: `backend/tests/tickets.test.ts`

**Interfaces:**
- Produces: `suggestTicketCategory(subject: string, existingCategories: string[]): Promise<string>`,
  exported from `backend/src/services/gemini.ts`, following the same
  `getModel()`/`generateContent()` pattern already used by
  `suggestReply`/`summarizeTicket`/`suggestRelevantArticleIds` in that
  file.

**Testing approach:** this project's tests never mock the Gemini SDK
(no `vi.mock` calls appear anywhere in `backend/tests/`) — instead the
test environment's `GEMINI_API_KEY` is intentionally left unset
(`backend/tests/env.setup.ts` sets no Gemini variables), so
`gemini.ts`'s `getModel()` genuinely throws `"GEMINI_API_KEY not
configured"` and `suggestTicketCategory`'s promise genuinely rejects —
giving a real, deterministic way to test the "Gemini unavailable, ticket
still creates successfully with category unchanged" path without mocking
anything. The "Gemini successfully returns a real category" path cannot
be deterministically automated this way (no real key in tests) — it is
covered by manual/real verification in Task 2 instead, exactly mirroring
how `docs/superpowers/plans/2026-08-25-new-message-notifications.md`
handled its own real-SMTP-optional verification step.

- [ ] **Step 1: Read the current `POST /` handler and `gemini.ts` in full**

Read `backend/src/routes/tickets.ts`'s current `POST /` handler (lines
90-121 as of this plan's writing — confirm the exact current shape
before editing, it was not touched by any prior Round 2 feature) and
`backend/src/services/gemini.ts`'s `suggestRelevantArticleIds` function
in full, to match its exact validate-the-output-against-a-real-set style.

- [ ] **Step 2: Write the failing tests**

Add these three tests to `backend/tests/tickets.test.ts`, inside the
existing `describe("tickets", ...)` block. `prisma` is already imported
in this file as of the new-message-notifications feature — confirm that
import is still present before adding these.

```typescript
  it("keeps category General when Gemini is unavailable (test env has no GEMINI_API_KEY)", async () => {
    const customer = await createUser({ email: "catgeneral@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "My internet keeps disconnecting", priority: "Medium" });

    expect(res.status).toBe(201);
    expect(res.body.ticket.category).toBe("General");
  });

  it("never overrides an explicit non-default category", async () => {
    const customer = await createUser({ email: "catexplicit@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Ambiguous subject that could be anything", priority: "Low", category: "Billing" });

    expect(res.status).toBe(201);
    expect(res.body.ticket.category).toBe("Billing");
  });

  it("does not call Gemini at all when an explicit category is provided", async () => {
    // Regression guard for the "skip the AI call entirely" requirement,
    // not just "the result happens to still be Billing" — if the category
    // stored in the DB right after creation (before any async enrichment
    // could plausibly finish) is already the explicit value, the AI path
    // was never taken.
    const customer = await createUser({ email: "catskip@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Need help with my invoice", priority: "Low", category: "Account" });

    expect(res.status).toBe(201);
    const stored = await prisma.ticket.findUnique({ where: { id: res.body.ticket.id } });
    expect(stored?.category).toBe("Account");
  });
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd backend && npm test -- tickets.test.ts`
Expected: all three FAIL or error, since `POST /` doesn't call
`suggestTicketCategory` yet (the first test's assertion trivially passes
today since category already defaults to `"General"` with no AI call —
that's expected and fine, it's guarding a regression once Step 5 is
done, not currently exercising new behavior; the second and third tests
should already pass too, for the same reason. None of the three should
hard-fail at this point — that's fine, Step 5 is additive behavior, not
a behavior change to the explicit-category path).

- [ ] **Step 4: Add `suggestTicketCategory` to `gemini.ts`**

Add this function to `backend/src/services/gemini.ts`, after
`suggestRelevantArticleIds`:

```typescript
export async function suggestTicketCategory(
  subject: string,
  existingCategories: string[]
): Promise<string> {
  if (existingCategories.length === 0) return "General";
  const model = getModel();

  const categoryList = existingCategories.join(", ");

  const prompt = `A new support ticket needs a category assigned. Pick exactly ONE
category from the list below that best matches the ticket's subject, or
respond with "General" if none fit well. Respond with ONLY the category
name, nothing else — no punctuation, no explanation.

Available categories: ${categoryList}

Ticket subject: ${subject}

Category:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const validCategories = new Set([...existingCategories, "General"]);
  return validCategories.has(text) ? text : "General";
}
```

This mirrors `suggestRelevantArticleIds`'s anti-hallucination guard: the
model's raw text output is only trusted if it exactly matches something
already known to be real (an existing category, queried fresh by the
caller) — any other output (a hallucinated category, extra punctuation,
a refusal) silently falls back to `"General"`.

- [ ] **Step 5: Wire it into `POST /` in `tickets.ts`**

In `backend/src/routes/tickets.ts`, add `suggestTicketCategory` to the
existing Gemini import on line 6:

```typescript
import { suggestReply, summarizeTicket, suggestRelevantArticleIds, suggestTicketCategory } from "../services/gemini";
```

Then, in the `POST /` handler, insert this block after the existing
`ticketStatusHistory.create(...)` call and before `res.status(201).json(...)`:

```typescript
  let finalTicket = ticket;
  if (ticket.category === "General") {
    try {
      const distinct = await prisma.ticket.findMany({
        where: { category: { not: "General" } },
        distinct: ["category"],
        select: { category: true },
      });
      const existingCategories = distinct.map((t) => t.category);
      if (existingCategories.length > 0) {
        const suggested = await suggestTicketCategory(body.subject, existingCategories);
        if (suggested !== "General") {
          finalTicket = await prisma.ticket.update({
            where: { id: ticket.id },
            data: { category: suggested },
          });
        }
      }
    } catch (err) {
      console.error("Ticket category suggestion failed (non-fatal):", err);
    }
  }
```

Then change the final response line from `res.status(201).json({ ticket: toTicketDto(ticket) });`
to `res.status(201).json({ ticket: toTicketDto(finalTicket) });` so the
response reflects any AI-assigned category rather than the pre-enrichment
value.

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `cd backend && npm test -- tickets.test.ts`
Expected: all tests in this file pass, including the 3 new ones.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (67 existing + 3 new = 70).

- [ ] **Step 7: Manual real-Gemini verification (optional but recommended, per the spec's own verification plan)**

If a real `GEMINI_API_KEY` is configured in `backend/.env`, start the dev
server, seed a couple of tickets with distinct real categories (e.g.
"Billing", "Technical" — either via the UI or directly), then submit a
new ticket with an ambiguous subject (e.g. "I was charged twice this
month") and no explicit category, and confirm the created ticket ends up
with a sensible real category rather than `"General"`. If credentials
aren't available in this environment, skip this step and rely on the
automated tests — note which you did in your report.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/gemini.ts backend/src/routes/tickets.ts backend/tests/tickets.test.ts
git commit -m "feat: suggest ticket category via Gemini on creation"
```

---

### Task 2: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/26-ai-auto-categorization.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-055 Done)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all 70 tests pass.

- [ ] **Step 2: `npx tsc --noEmit` in `backend/` is clean**

- [ ] **Step 3: Update the spec, verification doc, and implementation plan**

In `26-ai-auto-categorization.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box that's
genuinely true based on Task 1's tests and (if performed) the manual
real-Gemini check — be explicit about whether the real-Gemini check was
actually performed, matching this project's established honesty
convention for partially-verified criteria (e.g. `21-staff-user-management.md`'s
token-validity-until-expiry criterion, `23-new-message-notifications.md`'s
non-fatal-failure criterion). If the manual check wasn't performed, the
first acceptance criterion ("ends up with a real, sensible category
picked from existing values ... when Gemini succeeds") should stay
unchecked with a one-line note explaining it's architecturally true
(same validated-output-against-a-real-set guard as the already-shipped
`suggestRelevantArticleIds`) but not directly observed in this
environment.

The fourth criterion ("the AI never assigns a category that didn't
already exist ... at the time of the call") is also not directly
exercised by the automated tests — the test environment's Gemini calls
always fail (no configured key), so `suggestTicketCategory`'s
validate-against-a-real-set guard never actually runs against a real
model response in CI. It is true by construction (the same
`validCategories.has(text)` check `suggestRelevantArticleIds` already
uses, unmodified in kind), not by direct test evidence — check this box
only if that basis is judged sufficient (this project checked the
equivalent criterion for `suggestRelevantArticleIds` on the same
architectural-correctness basis when it first shipped); otherwise leave
it unchecked with a note.

Add a row to `docs/verification.md`:
`| AI automatic ticket categorization (Gemini-suggested, grounded in existing categories only) | Automated tests (unavailable + explicit-category-respected paths) + [real-Gemini check if performed] | PASS |`.

In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-055 in the "Round 2" table and change its status from
`Not Started` to `Done`.

- [ ] **Step 4: Update `features/README.md`'s index**

In `docs/specs/001-customer-support-crm/features/README.md`, in the
paragraph listing Round 2 outcomes (after the sentence ending "...added
SMTP transport timeouts before this pattern's exposure grew from a rare
status transition to every staff reply)."), add one sentence for item 26
following the same style as items 20-23: what was built, and (once
Task 1 of this plan actually runs) whether the final review found and
fixed anything.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/26-ai-auto-categorization.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md docs/specs/001-customer-support-crm/features/README.md
git commit -m "docs: mark AI auto-categorization done, record verification"
```
