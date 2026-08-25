// backend/tests/liveChat.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("live chat REST", () => {
  it("a Customer can start a session and send a message", async () => {
    const customer = await createUser({ email: "livechatcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${token}`);
    expect(createRes.status).toBe(201);
    expect(createRes.body.session.status).toBe("Waiting");
    const sessionId = createRes.body.session.id;

    const msgRes = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Hello, I need help" });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.authorRole).toBe("Customer");
  });

  it("an Agent can claim a waiting session and reply", async () => {
    const customer = await createUser({ email: "livechatcust2@test.com", role: "Customer" });
    const agent = await createUser({ email: "livechatagent@test.com", role: "Agent" });
    const customerToken = tokenFor(customer);
    const agentToken = tokenFor(agent);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${customerToken}`);
    const sessionId = createRes.body.session.id;

    const claimRes = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/claim`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.session.status).toBe("Active");
    expect(claimRes.body.session.assignedAgentId).toBe(agent.id);

    const replyRes = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "Hi, how can I help?" });
    expect(replyRes.status).toBe(201);
  });

  it("cannot claim an already-claimed session", async () => {
    const customer = await createUser({ email: "livechatcust3@test.com", role: "Customer" });
    const agentA = await createUser({ email: "livechatagenta@test.com", role: "Agent" });
    const agentB = await createUser({ email: "livechatagentb@test.com", role: "Agent" });
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${customerToken}`);
    const sessionId = createRes.body.session.id;

    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentA)}`);

    const secondClaim = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentB)}`);
    expect(secondClaim.status).toBe(409);
  });

  it("a Customer cannot see or claim another customer's session", async () => {
    const customerA = await createUser({ email: "livechatcusta@test.com", role: "Customer" });
    const customerB = await createUser({ email: "livechatcustb@test.com", role: "Customer" });

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerA)}`);
    const sessionId = createRes.body.session.id;

    const res = await request(app)
      .get(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${tokenFor(customerB)}`);
    expect(res.status).toBe(403);
  });

  it("an unassigned Agent cannot post into a session assigned to a different agent", async () => {
    const customer = await createUser({ email: "livechatcust4@test.com", role: "Customer" });
    const agentA = await createUser({ email: "livechatagentc@test.com", role: "Agent" });
    const agentB = await createUser({ email: "livechatagentd@test.com", role: "Agent" });

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customer)}`);
    const sessionId = createRes.body.session.id;

    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentA)}`);

    const res = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${tokenFor(agentB)}`)
      .send({ body: "trying to butt in" });
    expect(res.status).toBe(403);
  });

  it("either party can end a session", async () => {
    const customer = await createUser({ email: "livechatcust5@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${token}`);
    const sessionId = createRes.body.session.id;

    const endRes = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${token}`);
    expect(endRes.status).toBe(200);
    expect(endRes.body.session.status).toBe("Ended");
    expect(endRes.body.session.endedAt).not.toBeNull();
  });

  it("cannot post a message to an already-ended session", async () => {
    const customer = await createUser({ email: "livechatcust6@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${token}`);
    const sessionId = createRes.body.session.id;

    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "still trying to chat" });
    expect(res.status).toBe(409);
  });
});
