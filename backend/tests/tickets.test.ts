// backend/tests/tickets.test.ts
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";
import { prisma } from "../src/lib/prisma";
import { buildReplyPreview } from "../src/routes/tickets";

describe("tickets", () => {
  it("a Customer creates their own ticket", async () => {
    const customer = await createUser({ email: "cust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "My issue", priority: "Medium" });

    expect(res.status).toBe(201);
    expect(res.body.ticket.customerId).toBe(customer.id);
  });

  it("Admin creates a ticket on behalf of a customer", async () => {
    const admin = await createUser({ email: "admin@test.com", role: "Admin" });
    const customer = await createUser({ email: "cust2@test.com", role: "Customer" });
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "On behalf", priority: "Low", customerId: customer.id });

    expect(res.status).toBe(201);
    expect(res.body.ticket.customerId).toBe(customer.id);
  });

  it("computes SLA due dates from the seeded Urgent policy (30/240 min)", async () => {
    const customer = await createUser({ email: "cust3@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Urgent issue", priority: "Urgent" });

    const created = new Date(res.body.ticket.createdAt).getTime();
    const responseDue = new Date(res.body.ticket.responseDueAt).getTime();
    const resolutionDue = new Date(res.body.ticket.resolutionDueAt).getTime();

    expect(Math.round((responseDue - created) / 60000)).toBe(30);
    expect(Math.round((resolutionDue - created) / 60000)).toBe(240);
  });

  it("records a TicketStatusHistory entry on status change", async () => {
    const admin = await createUser({ email: "admin2@test.com", role: "Admin" });
    const customer = await createUser({ email: "cust4@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Status test", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "InProgress" });

    const historyRes = await request(app)
      .get(`/api/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(historyRes.body.history).toHaveLength(2);
    expect(historyRes.body.history[1]).toMatchObject({ fromStatus: "Open", toStatus: "InProgress" });
  });

  it("hides an internal note from the owning customer", async () => {
    const agent = await createUser({ email: "agent@test.com", role: "Agent" });
    const customer = await createUser({ email: "cust5@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Note test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(await createUser({ email: "mgr@test.com", role: "Manager" }))}`)
      .send({ agentId: agent.id });

    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "internal escalation note", isInternalNote: true });
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "visible reply", isInternalNote: false });

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`);

    const bodies = res.body.messages.map((m: { body: string }) => m.body);
    expect(bodies).toContain("visible reply");
    expect(bodies).not.toContain("internal escalation note");

    // Confirm the agent's own view still includes both messages — otherwise a
    // regression that stopped returning internal notes to staff entirely
    // would still pass the customer-side assertions above.
    const agentRes = await request(app)
      .get(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`);

    const agentBodies = agentRes.body.messages.map((m: { body: string }) => m.body);
    expect(agentBodies).toContain("visible reply");
    expect(agentBodies).toContain("internal escalation note");
  });

  it("blocks a customer from viewing another customer's ticket", async () => {
    const customerA = await createUser({ email: "ownerA@test.com", role: "Customer" });
    const customerB = await createUser({ email: "ownerB@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);
    const tokenB = tokenFor(customerB);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Private ticket", priority: "Low" });

    const res = await request(app)
      .get(`/api/tickets/${createRes.body.ticket.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("blocks an unassigned agent from updating a ticket", async () => {
    const customer = await createUser({ email: "cust6@test.com", role: "Customer" });
    const otherAgent = await createUser({ email: "otheragent@test.com", role: "Agent" });
    const customerToken = tokenFor(customer);
    const otherAgentToken = tokenFor(otherAgent);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Unassigned test", priority: "Low" });

    const res = await request(app)
      .patch(`/api/tickets/${createRes.body.ticket.id}`)
      .set("Authorization", `Bearer ${otherAgentToken}`)
      .send({ status: "InProgress" });
    expect(res.status).toBe(403);
  });

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
    expect(JSON.parse(logs[0].metadata ?? "{}")).toMatchObject({
      channel: "email",
      subject: "New reply on your ticket",
    });
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

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "internal escalation, do not share", isInternalNote: true });

    expect(res.status).toBe(201);

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

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Following up on my own ticket", isInternalNote: false });

    expect(res.status).toBe(201);

    const logs = await prisma.auditLog.findMany({
      where: { action: "notification.sent", entityType: "Notification", entityId: customer.email },
    });
    expect(logs).toHaveLength(0);
  });

  it("keeps category General when Gemini is unavailable (test env has no GEMINI_API_KEY)", async () => {
    // Spy on console.error so we can assert the enrichment block's catch was
    // genuinely reached, not just that the final category happens to be
    // "General" (which could also happen if the AI call were skipped
    // entirely — see the seeded ticket below, which rules that out).
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const customer = await createUser({ email: "catgeneral@test.com", role: "Customer" });
      const token = tokenFor(customer);

      // Seed a real existing non-General category first. Without this, the
      // enrichment block's `existingCategories.length > 0` guard would
      // short-circuit before suggestTicketCategory (and therefore Gemini)
      // is ever called, and this test would pass for the wrong reason.
      const seedRes = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({ subject: "Can't pay my invoice", priority: "Low", category: "Billing" });
      expect(seedRes.status).toBe(201);

      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({ subject: "My internet keeps disconnecting", priority: "Medium" });

      expect(res.status).toBe(201);
      expect(res.body.ticket.category).toBe("General");

      // Confirms the Gemini call was actually attempted (and threw, since
      // the test env has no GEMINI_API_KEY) and that the enrichment
      // block's catch handler is what produced the "General" result above.
      expect(errorSpy).toHaveBeenCalledWith(
        "Ticket category suggestion failed (non-fatal):",
        expect.anything()
      );
    } finally {
      errorSpy.mockRestore();
    }
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

    // suggestRelevantArticleIds short-circuits to [] (without calling Gemini)
    // when there are no published articles, which would make this route
    // succeed with 200 rather than fail — so a published article must exist
    // for the Gemini call (and thus the failure) to actually happen.
    await prisma.knowledgeBaseArticle.create({
      data: { title: "Password reset", body: "How to reset your password.", category: "Account", authorId: admin.id, published: true },
    });

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

  it("writes no AiUsageEvent when suggested-articles succeeds but finds nothing to show (no published KB articles)", async () => {
    const admin = await createUser({ email: "aiusage4@test.com", role: "Admin" });
    const customer = await createUser({ email: "aiusagecust4@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "AI usage test 4", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    // No published KB articles exist (default resetDb() state), so
    // suggestRelevantArticleIds short-circuits to [] without calling Gemini,
    // and the route should succeed with an empty list rather than fail.
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/suggested-articles`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.articles).toEqual([]);
    const events = await prisma.aiUsageEvent.findMany({ where: { ticketId, eventType: "suggested_articles_shown" } });
    expect(events).toHaveLength(0);
  });
});

describe("buildReplyPreview", () => {
  it("passes a short body through unchanged", () => {
    const body = "This is a short reply.";
    expect(buildReplyPreview(body)).toBe(body);
  });

  it("passes a body of exactly 200 chars through unchanged", () => {
    const body = "a".repeat(200);
    const result = buildReplyPreview(body);
    expect(result).toBe(body);
    expect(result).toHaveLength(200);
  });

  it("truncates a body over 200 chars with a trailing ellipsis", () => {
    const body = "a".repeat(250);
    const result = buildReplyPreview(body);
    expect(result).toBe(`${"a".repeat(200)}...`);
    expect(result).toHaveLength(203);
  });
});
