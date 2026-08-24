// backend/tests/tickets.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

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
});
