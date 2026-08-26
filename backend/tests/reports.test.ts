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
