import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createStaffUserSchema, listUsersQuerySchema, updateUserSchema } from "../validation/users.schema";
import { writeAuditLog } from "../lib/audit";

const router = Router();

function toPublicUser(user: {
  id: string;
  email: string;
  role: string;
  name: string;
  locale: string;
  departmentId: string | null;
  branchId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    locale: user.locale,
    departmentId: user.departmentId,
    branchId: user.branchId,
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw Errors.notFound("User not found");
  res.json({ user: toPublicUser(user) });
});

router.get("/", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const query = listUsersQuerySchema.parse(req.query);
  const users = await prisma.user.findMany({ where: query.role ? { role: query.role } : undefined });
  res.json({ users: users.map(toPublicUser) });
});

router.post("/", requireAuth, requireRole("Admin"), async (req, res) => {
  const body = createStaffUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw Errors.conflict("Email already registered");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      name: body.name,
      role: body.role,
      departmentId: body.departmentId,
      branchId: body.branchId,
    },
  });
  await writeAuditLog(req.user!.id, "user.create", "User", user.id, { role: user.role, email: user.email });
  res.status(201).json({ user: toPublicUser(user) });
});

router.get("/:id", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Errors.notFound("User not found");
  res.json({ user: toPublicUser(user) });
});

router.patch("/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  const id = String(req.params.id);
  const body = updateUserSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("User not found");

  const user = await prisma.user.update({ where: { id }, data: body });
  res.json({ user: toPublicUser(user) });
});

export default router;
