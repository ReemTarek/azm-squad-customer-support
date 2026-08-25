// backend/tests/attachments.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("attachments", () => {
  it("a Customer can attach a file to their own new ticket message", async () => {
    const customer = await createUser({ email: "attachcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "Here is a screenshot")
      .attach("file", Buffer.from("fake png bytes"), { filename: "shot.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.message.attachments).toHaveLength(1);
    expect(res.body.message.attachments[0].fileName).toBe("shot.png");
  });

  it("the uploading customer can download their own attachment", async () => {
    const customer = await createUser({ email: "attachcust2@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Download test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "attaching a file")
      .attach("file", Buffer.from("fake file contents"), { filename: "doc.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe("fake file contents");
  });

  it("a different customer cannot download another customer's attachment", async () => {
    const customerA = await createUser({ email: "attacha@test.com", role: "Customer" });
    const customerB = await createUser({ email: "attachb@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);
    const tokenB = tokenFor(customerB);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Private attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .field("body", "private file")
      .attach("file", Buffer.from("private contents"), { filename: "private.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("a Customer cannot download an attachment on an internal note", async () => {
    const agent = await createUser({ email: "attachagent@test.com", role: "Agent" });
    const customer = await createUser({ email: "attachcust3@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Internal note attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(await createUser({ email: "attachmgr@test.com", role: "Manager" }))}`)
      .send({ agentId: agent.id });

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .field("body", "internal escalation")
      .field("isInternalNote", "true")
      .attach("file", Buffer.from("internal contents"), { filename: "internal.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a file over the 10MB limit", async () => {
    const customer = await createUser({ email: "attachcust4@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Oversized file test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const oversized = Buffer.alloc(11 * 1024 * 1024);
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "too big")
      .attach("file", oversized, { filename: "huge.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a disallowed file type", async () => {
    const customer = await createUser({ email: "attachcust5@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Bad file type test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "sketchy file")
      .attach("file", Buffer.from("MZ fake exe"), { filename: "virus.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("fails closed when an attachment row has neither parent FK set (invariant violation)", async () => {
    const customer = await createUser({ email: "attachcust6@test.com", role: "Customer" });
    const token = tokenFor(customer);

    // Bypass the normal creation routes to simulate a row that violates the
    // "exactly one of ticketMessageId/customerId is set" invariant, proving
    // the download route rejects rather than silently allowing access.
    const orphanAttachment = await prisma.attachment.create({
      data: {
        fileName: "orphan.txt",
        mimeType: "text/plain",
        sizeBytes: 3,
        storagePath: "orphan.txt",
        uploadedById: customer.id,
      },
    });

    const res = await request(app)
      .get(`/api/attachments/${orphanAttachment.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
