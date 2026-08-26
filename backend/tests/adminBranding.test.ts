import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("admin branding", () => {
  it("returns all-null defaults when unconfigured (public, no auth needed)", async () => {
    const res = await request(app).get("/api/admin/branding");

    expect(res.status).toBe(200);
    expect(res.body.config).toEqual({ appName: null, primaryColor: null, logoUrl: null });
  });

  it("404s the logo route when no logo is configured", async () => {
    const res = await request(app).get("/api/admin/branding/logo");
    expect(res.status).toBe(404);
  });

  it("rejects a non-Admin PATCH with 403", async () => {
    const agent = await createUser({ email: "brandagent@test.com", role: "Agent" });
    const token = tokenFor(agent);

    const res = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Agent's Attempted Brand");

    expect(res.status).toBe(403);
    const check = await request(app).get("/api/admin/branding");
    expect(check.body.config.appName).toBeNull();
  });

  it("lets an Admin set the app name and color, and the change is publicly visible", async () => {
    const admin = await createUser({ email: "brandadmin1@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const patchRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Acme Support")
      .field("primaryColor", "#2f6fed");

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.config).toEqual({ appName: "Acme Support", primaryColor: "#2f6fed", logoUrl: null });

    const publicRes = await request(app).get("/api/admin/branding");
    expect(publicRes.body.config).toEqual({ appName: "Acme Support", primaryColor: "#2f6fed", logoUrl: null });
  });

  it("rejects a malformed primaryColor", async () => {
    const admin = await createUser({ email: "brandadmin2@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("primaryColor", "blue");

    expect(res.status).toBe(400);
  });

  it("lets an Admin upload a logo, and it's servable publicly", async () => {
    const admin = await createUser({ email: "brandadmin3@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const patchRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("fake-png-bytes"), { filename: "logo.png", contentType: "image/png" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.config.logoUrl).toBe("/api/admin/branding/logo");

    const logoRes = await request(app).get("/api/admin/branding/logo");
    expect(logoRes.status).toBe(200);
  });

  it("clears the app name and color back to null via empty-string fields", async () => {
    const admin = await createUser({ email: "brandadmin4@test.com", role: "Admin" });
    const token = tokenFor(admin);

    await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Temporary Name")
      .field("primaryColor", "#123456");

    const clearRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "")
      .field("primaryColor", "");

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.config).toEqual({ appName: null, primaryColor: null, logoUrl: null });
  });

  it("clears the logo via removeLogo=true, and the old file is deleted from disk", async () => {
    const admin = await createUser({ email: "brandadmin5@test.com", role: "Admin" });
    const token = tokenFor(admin);

    await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("fake-png-bytes-2"), { filename: "logo2.png", contentType: "image/png" });

    const configBefore = await prisma.brandingConfig.findUnique({ where: { id: "singleton" } });
    const storedPath = configBefore!.logoPath!;

    const clearRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("removeLogo", "true");

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.config.logoUrl).toBeNull();

    const { UPLOAD_DIR } = await import("../src/lib/upload");
    const fs = await import("node:fs");
    const path = await import("node:path");
    expect(fs.existsSync(path.join(UPLOAD_DIR, storedPath))).toBe(false);

    const logoRes = await request(app).get("/api/admin/branding/logo");
    expect(logoRes.status).toBe(404);
  });
});
