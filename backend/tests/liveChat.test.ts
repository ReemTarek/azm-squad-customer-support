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

  it("an Agent's GET /sessions includes Waiting and their own Active sessions but not another agent's Active session", async () => {
    const customerWaiting = await createUser({ email: "livechatcustw1@test.com", role: "Customer" });
    const customerOwn = await createUser({ email: "livechatcusto1@test.com", role: "Customer" });
    const customerOther = await createUser({ email: "livechatcusts1@test.com", role: "Customer" });
    const agentSelf = await createUser({ email: "livechatagentself@test.com", role: "Agent" });
    const agentOther = await createUser({ email: "livechatagentother@test.com", role: "Agent" });

    const waitingRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerWaiting)}`);
    const waitingId = waitingRes.body.session.id;

    const ownRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerOwn)}`);
    const ownId = ownRes.body.session.id;
    await request(app)
      .post(`/api/live-chat/sessions/${ownId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentSelf)}`);

    const otherRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerOther)}`);
    const otherId = otherRes.body.session.id;
    await request(app)
      .post(`/api/live-chat/sessions/${otherId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentOther)}`);

    const listRes = await request(app)
      .get("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(agentSelf)}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.sessions.map((s: { id: string }) => s.id);
    expect(ids).toContain(waitingId);
    expect(ids).toContain(ownId);
    expect(ids).not.toContain(otherId);
  });

  it("an Admin's GET /sessions includes all Active sessions regardless of assigned agent, plus Waiting", async () => {
    const admin = await createUser({ email: "livechatadmin1@test.com", role: "Admin" });
    const customerWaiting = await createUser({ email: "livechatcustw2@test.com", role: "Customer" });
    const customerA = await createUser({ email: "livechatcusta2@test.com", role: "Customer" });
    const customerB = await createUser({ email: "livechatcustb2@test.com", role: "Customer" });
    const agentA = await createUser({ email: "livechatagenta2@test.com", role: "Agent" });
    const agentB = await createUser({ email: "livechatagentb2@test.com", role: "Agent" });

    const waitingRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerWaiting)}`);
    const waitingId = waitingRes.body.session.id;

    const sessionARes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerA)}`);
    const sessionAId = sessionARes.body.session.id;
    await request(app)
      .post(`/api/live-chat/sessions/${sessionAId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentA)}`);

    const sessionBRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerB)}`);
    const sessionBId = sessionBRes.body.session.id;
    await request(app)
      .post(`/api/live-chat/sessions/${sessionBId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agentB)}`);

    const listRes = await request(app)
      .get("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.sessions.map((s: { id: string }) => s.id);
    expect(ids).toContain(waitingId);
    expect(ids).toContain(sessionAId);
    expect(ids).toContain(sessionBId);
  });
});
