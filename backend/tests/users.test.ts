// backend/tests/users.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("users", () => {
  it("an Admin cannot deactivate their own account", async () => {
    const admin = await createUser({ email: "self-admin@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);

    const me = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.isActive).toBe(true);
  });

  it("the last active Admin cannot change their own role away from Admin", async () => {
    const admin = await createUser({ email: "self-admin-role@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Manager" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain("last active Admin");

    const me = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("Admin");
  });

  it("blocks deactivating a different Admin when it would leave zero active Admins", async () => {
    // The acting Admin's own DB row is already inactive here — modeling a stale-but-
    // still-valid access token (deactivation doesn't revoke already-issued access
    // tokens; see decisions.md). They are the only other Admin besides the target,
    // so deactivating the target would zero out the active Admin pool entirely.
    const actingAdmin = await createUser({ email: "acting-admin@test.com", role: "Admin", isActive: false });
    const targetAdmin = await createUser({ email: "target-admin@test.com", role: "Admin" });
    const token = tokenFor(actingAdmin);

    const res = await request(app)
      .patch(`/api/users/${targetAdmin.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain("last active Admin");

    const check = await request(app)
      .get(`/api/users/${targetAdmin.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(check.body.user.isActive).toBe(true);
  });

  it("blocks demoting a different Admin's role when it would leave zero active Admins", async () => {
    const actingAdmin = await createUser({ email: "acting-admin-2@test.com", role: "Admin", isActive: false });
    const targetAdmin = await createUser({ email: "target-admin-2@test.com", role: "Admin" });
    const token = tokenFor(actingAdmin);

    const res = await request(app)
      .patch(`/api/users/${targetAdmin.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Manager" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain("last active Admin");
  });
});
