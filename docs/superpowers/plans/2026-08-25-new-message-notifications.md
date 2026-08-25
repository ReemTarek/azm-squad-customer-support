# New-Message Customer Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-25

**Goal:** Notify a customer by email when staff post a new visible
(non-internal) reply on their ticket — today `notifyCustomer` is only
ever called on the resolved/closed status transition, never on a new
message, so a customer only learns about a reply by returning to the
portal.

**Architecture:** One addition to `POST /api/tickets/:id/messages`:
after creating the message, if it's non-internal and staff-authored,
look up the ticket's customer and call the exact same
`notifyCustomer("email", ...)` helper the resolved/closed path already
uses, wrapped in the same non-fatal `.catch(...)`. No schema change,
no new files, no new channel — this is a small, targeted addition to
one existing handler.

**Tech Stack:** Existing Prisma/Express/Vitest+Supertest stack, no new
dependencies.

**Spec:** `docs/specs/001-customer-support-crm/features/23-new-message-notifications.md`

## Global Constraints

- Only a message with `isInternalNote === false` **and** an author
  whose role is not `Customer` triggers a notification — internal
  notes must never leak to the customer via any channel, and a
  customer's own message must never notify themselves.
- A notification-dispatch failure must never fail the message-post
  request — same `.catch((err) => console.error(...))` pattern already
  used at the resolved/closed call site.
- No batching, no change to the resolved/closed notification path, no
  SMS/WhatsApp — all explicitly out of scope per the spec.

---

### Task 1: Add the notification call and test it via the audit log

**Files:**
- Modify: `backend/src/routes/tickets.ts`
- Modify: `backend/tests/tickets.test.ts`

**Interfaces:**
- Consumes: `notifyCustomer` (already imported in `tickets.ts`, used by
  the resolved/closed path — no new import needed).

**Testing approach:** the test environment's SMTP credentials are
intentionally blank (`backend/tests/env.setup.ts`), so
`SmtpEmailChannel.send()` takes its "unconfigured" console-log
fallback branch and never throws — meaning `notifyCustomer`'s
`writeAuditLog(actorId, "notification.sent", "Notification", to, {channel, subject})`
call genuinely runs to completion in tests. This gives a real,
deterministic way to test "was a notification attempted" without
mocking anything or needing real SMTP credentials: query
`prisma.auditLog` for an `action: "notification.sent"` row with
`entityId` equal to the customer's email.

- [ ] **Step 1: Read the current `POST /:id/messages` handler**

Read `backend/src/routes/tickets.ts`'s current `POST /:id/messages`
handler in full (it was recently modified by the attachments feature —
confirm its exact current shape, including the `loadTicketForAccess`
middleware and the `req.file` handling, before editing) and the
resolved/closed path's existing `notifyCustomer` call (search for
`"Your ticket has been resolved"`) to match its exact style.

- [ ] **Step 2: Write the failing tests**

Add these three tests to `backend/tests/tickets.test.ts`, inside the
existing `describe("tickets", ...)` block:

```typescript
  it("notifies the customer by email when staff post a visible reply", async () => {
    const admin = await createUser({ email: "notifyadmin@test.com", role: "Admin" });
    const customer = await createUser({ email: "notifycust@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Notify test", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "Here is an update on your issue.", isInternalNote: false });

    const logs = await prisma.auditLog.findMany({
      where: { action: "notification.sent", entityType: "Notification", entityId: customer.email },
    });
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0].metadata ?? "{}")).toMatchObject({ subject: "New reply on your ticket" });
  });

  it("does not notify the customer when staff post an internal note", async () => {
    const admin = await createUser({ email: "notifyadmin2@test.com", role: "Admin" });
    const customer = await createUser({ email: "notifycust2@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Internal note notify test", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "internal escalation, do not share", isInternalNote: true });

    const logs = await prisma.auditLog.findMany({
      where: { action: "notification.sent", entityType: "Notification", entityId: customer.email },
    });
    expect(logs).toHaveLength(0);
  });

  it("does not notify a customer of their own message", async () => {
    const customer = await createUser({ email: "notifycust3@test.com", role: "Customer" });
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Self notify test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Following up on my own ticket", isInternalNote: false });

    const logs = await prisma.auditLog.findMany({
      where: { action: "notification.sent", entityType: "Notification", entityId: customer.email },
    });
    expect(logs).toHaveLength(0);
  });
```

`backend/tests/tickets.test.ts` does not currently import `prisma` —
confirmed by reading its current top-of-file imports (`describe`/`it`/
`expect` from vitest, `request` from supertest, `app`,
`createUser`/`tokenFor`). Add
`import { prisma } from "../src/lib/prisma";` alongside them (several
other test files already do this, e.g. `org-scoping.test.ts`).

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd backend && npm test -- tickets.test.ts`
Expected: the first new test FAILS (no `notification.sent` audit log
row exists yet, since the handler doesn't call `notifyCustomer` for
new messages). The other two should already pass trivially (nothing
to notify about yet either way) — that's fine, they're guarding
against a regression once Step 4 is done, not currently exercising new
behavior.

- [ ] **Step 4: Add the notification call to `POST /:id/messages`**

In `backend/src/routes/tickets.ts`, insert this block into the
`POST /:id/messages` handler, after the `const message = await prisma.ticketMessage.create({...})` call and before the `res.status(201).json(...)` line:

```typescript
    if (!isInternalNote && user.role !== "Customer") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        select: { customerId: true, subject: true },
      });
      if (ticket) {
        const customer = await prisma.user.findUnique({ where: { id: ticket.customerId } });
        if (customer) {
          const preview = body.body.length > 200 ? `${body.body.slice(0, 200)}...` : body.body;
          await notifyCustomer(
            "email",
            customer.email,
            "New reply on your ticket",
            `You have a new reply on your ticket "${ticket.subject}":\n\n${preview}`,
            user.id
          ).catch((err) => console.error("Notification dispatch failed (non-fatal):", err));
        }
      }
    }
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `cd backend && npm test -- tickets.test.ts`
Expected: all tests in this file pass, including the 3 new ones.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (43 existing + 3 new = 46).

- [ ] **Step 6: Manual real-email verification (optional but recommended, per the spec's own verification plan)**

If real SMTP credentials are configured in `backend/.env` (they were
set up earlier in this project — `SMTP_USER`/`SMTP_PASS`), start the
dev server, post a visible reply as an Agent/Admin to a ticket whose
customer email you control, and confirm a real email arrives with the
subject "New reply on your ticket". Post an internal note and confirm
no email arrives. If credentials aren't currently available in this
environment, skip this step and rely on the audit-log-based automated
tests — note which you did in your report.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/tickets.ts backend/tests/tickets.test.ts
git commit -m "feat: notify customer by email on a new staff reply"
```

---

### Task 2: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/23-new-message-notifications.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-052 Done)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all 46 tests pass.

- [ ] **Step 2: `npx tsc --noEmit` in `backend/` is clean**

- [ ] **Step 3: Update the spec, verification doc, and implementation plan**

In `23-new-message-notifications.md`, change `## Status: Not Started`
to `## Status: Done` and check every acceptance-criteria box that's
genuinely true based on Task 1's tests and (if performed) the manual
real-email check — be explicit in the spec about whether the real-email
check was actually performed or whether the audit-log-based automated
tests are the only evidence, so the record is honest either way.

The 4th acceptance criterion ("a notification-dispatch failure does
not cause the message-post API call to fail or roll back") is **not**
covered by any of Task 1's three tests — none of them simulate a
`notifyCustomer` failure. It's true by construction (the same
`.catch((err) => ...)` pattern already used, unmodified, at the
resolved/closed call site, which itself was never dedicated-tested for
this exact failure scenario either), not by direct test evidence. Check
this box only if you're satisfied that "identical to an existing,
already-shipped pattern" is sufficient basis — if not, leave it
unchecked with a one-line note explaining why, the same honest
treatment this project has given similar architecturally-true-but-
untested criteria elsewhere (e.g. `21-staff-user-management.md`'s
token-validity-until-expiry criterion).

Add a row to `docs/verification.md`:
`| New-message customer notifications (email on visible reply, none on internal note or self-message) | Automated audit-log-based tests + [real-email check if performed] | PASS |`.

In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-052 in the "Round 2" table and change its status from
`Not Started` to `Done`.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/23-new-message-notifications.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md
git commit -m "docs: mark new-message notifications done, record verification"
```
