// backend/tests/customers.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("customers", () => {
  it("Admin creates a customer", async () => {
    const admin = await createUser({ email: "admin@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "created-customer@test.com", password: "Password123!", name: "Created Customer" });

    expect(res.status).toBe(201);
    expect(res.body.customer.email).toBe("created-customer@test.com");
  });

  it("a Customer can view their own record", async () => {
    const customer = await createUser({ email: "self@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .get(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("a Customer cannot view another customer's record", async () => {
    const customerA = await createUser({ email: "a@test.com", role: "Customer" });
    const customerB = await createUser({ email: "b@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);

    const res = await request(app)
      .get(`/api/customers/${customerB.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
  });
});
