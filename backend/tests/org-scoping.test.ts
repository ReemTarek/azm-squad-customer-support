// backend/tests/org-scoping.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser, tokenFor } from "./helpers/fixtures";

async function createTicketInDepartment(customerId: string, departmentId: string) {
  const now = new Date();
  return prisma.ticket.create({
    data: {
      customerId,
      departmentId,
      subject: "Dept ticket",
      priority: "Low",
      responseDueAt: new Date(now.getTime() + 1440 * 60000),
      resolutionDueAt: new Date(now.getTime() + 4320 * 60000),
    },
  });
}

describe("department/branch RBAC scoping", () => {
  it("a Manager scoped to Department A only sees Department A tickets", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketA = await createTicketInDepartment(customer.id, deptA.id);
    await createTicketInDepartment(customer.id, deptB.id);

    const listRes = await request(app).get("/api/tickets").set("Authorization", `Bearer ${managerToken}`);
    const subjects = listRes.body.tickets.map((t: { id: string }) => t.id);
    expect(subjects).toContain(ticketA.id);
    expect(subjects).toHaveLength(1);
  });

  it("a Manager scoped to Department A gets 403 fetching a Department B ticket directly", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust2@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr2@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketB = await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app)
      .get(`/api/tickets/${ticketB.id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("a Manager scoped to Department A gets 403 updating a Department B ticket", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust3@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr3@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketB = await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app)
      .patch(`/api/tickets/${ticketB.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "InProgress" });
    expect(res.status).toBe(403);
  });

  it("Admin remains unrestricted across departments", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust4@test.com", role: "Customer" });
    const admin = await createUser({ email: "orgadmin@test.com", role: "Admin" });
    const adminToken = tokenFor(admin);

    await createTicketInDepartment(customer.id, deptA.id);
    await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app).get("/api/tickets").set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.tickets).toHaveLength(2);
  });
});
