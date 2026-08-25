import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("auth", () => {
  it("registers a new customer and returns tokens", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "newcustomer@test.com",
      password: "Password123!",
      name: "New Customer",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Customer");
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "logintest@test.com",
      password: "Password123!",
      name: "Login Test",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "logintest@test.com",
      password: "Password123!",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("logintest@test.com");
  });

  it("rejects login with wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      email: "wrongpass@test.com",
      password: "Password123!",
      name: "Wrong Pass",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrongpass@test.com",
      password: "IncorrectPassword!",
    });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("rejects login for a deactivated account", async () => {
    const user = await createUser({
      email: "deactivated@test.com",
      role: "Agent",
      isActive: false,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "deactivated@test.com",
      password: "Password123!",
    });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("refreshes tokens with a valid refresh token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "refreshtest@test.com",
      password: "Password123!",
      name: "Refresh Test",
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: registerRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not-a-real-token" });
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with no Authorization header", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with a malformed/invalid Bearer token", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer not-a-valid-jwt.definitely-not.signed");
    expect(res.status).toBe(401);
  });

  it("rejects a Customer token on an Admin-only route", async () => {
    const customer = await createUser({ email: "cust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
