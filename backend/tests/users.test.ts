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
});
