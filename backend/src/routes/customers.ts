import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCustomerSchema, updateCustomerSchema } from "../validation/customers.schema";
import { createCustomerNoteSchema } from "../validation/customerNotes.schema";
import { writeAuditLog } from "../lib/audit";
import { erpClient } from "../integrations/erpClient";
import { upload } from "../lib/upload";
import { toAttachmentDto } from "../lib/attachmentDto";

const router = Router();

function toPublicCustomer(user: {
  id: string;
  email: string;
  name: string;
  locale: string;
  createdAt: Date;
  customerProfile: { phone: string | null; company: string | null } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    createdAt: user.createdAt,
    phone: user.customerProfile?.phone ?? null,
    company: user.customerProfile?.company ?? null,
  };
}

router.get("/", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const customers = await prisma.user.findMany({
    where: {
      role: "Customer",
      ...(search
        ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
        : {}),
    },
    include: { customerProfile: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ customers: customers.map(toPublicCustomer) });
});

router.post("/", requireAuth, requireRole("Admin", "Agent"), async (req, res) => {
  const body = createCustomerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw Errors.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name,
      role: "Customer",
      customerProfile: { create: { phone: body.phone, company: body.company } },
    },
    include: { customerProfile: true },
  });

  await writeAuditLog(req.user!.id, "customer.create", "User", user.id, { email: user.email });

  // Demonstrates the ERP integration boundary (mock client — see integrations/erpClient.ts).
  await erpClient.syncCustomer({ id: user.id, email: user.email, name: user.name }).catch((err) =>
    console.error("ERP sync failed (non-fatal):", err)
  );

  res.status(201).json({ customer: toPublicCustomer(user) });
});

router.get("/:id", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const id = String(req.params.id);
  if (req.user!.role === "Customer" && req.user!.id !== id) {
    throw Errors.forbidden("Cannot view another customer's record");
  }

  const user = await prisma.user.findUnique({ where: { id }, include: { customerProfile: true } });
  if (!user || user.role !== "Customer") throw Errors.notFound("Customer not found");

  res.json({ customer: toPublicCustomer(user) });
});

router.patch("/:id", requireAuth, requireRole("Admin", "Agent", "Customer"), async (req, res) => {
  const id = String(req.params.id);
  if (req.user!.role === "Customer" && req.user!.id !== id) {
    throw Errors.forbidden("Cannot update another customer's record");
  }

  const body = updateCustomerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { id }, include: { customerProfile: true } });
  if (!existing || existing.role !== "Customer") throw Errors.notFound("Customer not found");

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      customerProfile: {
        upsert: {
          create: { phone: body.phone, company: body.company },
          update: { phone: body.phone, company: body.company },
        },
      },
    },
    include: { customerProfile: true },
  });

  res.json({ customer: toPublicCustomer(user) });
});

router.get("/:id/notes", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const customerId = String(req.params.id);
  const notes = await prisma.customerNote.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
  res.json({ notes: notes.map((n) => ({ id: n.id, body: n.body, authorName: n.author.name, createdAt: n.createdAt })) });
});

router.post("/:id/notes", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const customerId = String(req.params.id);
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");

  const body = createCustomerNoteSchema.parse(req.body);
  const note = await prisma.customerNote.create({
    data: { customerId, authorId: req.user!.id, body: body.body },
    include: { author: { select: { name: true } } },
  });

  res.status(201).json({ note: { id: note.id, body: note.body, authorName: note.author.name, createdAt: note.createdAt } });
});

router.post(
  "/:id/attachments",
  requireAuth,
  requireRole("Admin", "Manager", "Agent"),
  upload.single("file"),
  async (req, res) => {
    const customerId = String(req.params.id);
    const customer = await prisma.user.findUnique({ where: { id: customerId } });
    if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");
    if (!req.file) {
      throw Errors.validation("A file is required", [{ field: "file", message: "A file is required" }]);
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: req.file.filename,
        uploadedById: req.user!.id,
        customerId,
      },
    });
    res.status(201).json({ attachment: toAttachmentDto(attachment) });
  }
);

router.get("/:id/attachments", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const customerId = String(req.params.id);
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");

  const attachments = await prisma.attachment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ attachments: attachments.map(toAttachmentDto) });
});

export default router;
