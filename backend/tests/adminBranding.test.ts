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
    expect(patchRes.body.config.logoUrl).toMatch(/^\/api\/admin\/branding\/logo\?v=\d+$/);

    const logoRes = await request(app).get("/api/admin/branding/logo");
    expect(logoRes.status).toBe(200);
  });

  it("changes the logoUrl's cache-busting param when the logo is replaced with a different file", async () => {
    const admin = await createUser({ email: "brandadmin6@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const firstRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("first-logo-bytes"), { filename: "logo-a.png", contentType: "image/png" });

    expect(firstRes.status).toBe(200);
    const firstLogoUrl = firstRes.body.config.logoUrl as string;
    expect(firstLogoUrl).toMatch(/^\/api\/admin\/branding\/logo\?v=\d+$/);

    // Guarantee the two upserts land in different milliseconds so the
    // updatedAt-derived cache-busting param is actually forced to differ,
    // rather than relying on incidental request latency.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const secondRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("second-logo-bytes-different"), { filename: "logo-b.png", contentType: "image/png" });

    expect(secondRes.status).toBe(200);
    const secondLogoUrl = secondRes.body.config.logoUrl as string;
    expect(secondLogoUrl).toMatch(/^\/api\/admin\/branding\/logo\?v=\d+$/);

    expect(secondLogoUrl).not.toBe(firstLogoUrl);
  });

  it("preserves fields untouched by a later PATCH that only sets a different field", async () => {
    const admin = await createUser({ email: "brandadmin7@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const nameRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("appName", "Isolation Test Co");

    expect(nameRes.status).toBe(200);
    expect(nameRes.body.config.appName).toBe("Isolation Test Co");

    const colorRes = await request(app)
      .patch("/api/admin/branding")
      .set("Authorization", `Bearer ${token}`)
      .field("primaryColor", "#abcdef");

    expect(colorRes.status).toBe(200);
    expect(colorRes.body.config.primaryColor).toBe("#abcdef");

    const getRes = await request(app).get("/api/admin/branding");
    expect(getRes.body.config.appName).toBe("Isolation Test Co");
    expect(getRes.body.config.primaryColor).toBe("#abcdef");
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
