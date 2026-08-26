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
