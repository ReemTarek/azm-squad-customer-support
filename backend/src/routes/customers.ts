import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCustomerSchema, updateCustomerSchema } from "../validation/customers.schema";
import { writeAuditLog } from "../lib/audit";

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

export default router;
