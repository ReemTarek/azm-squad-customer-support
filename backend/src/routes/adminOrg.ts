import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createOrgUnitSchema, updateOrgUnitSchema } from "../validation/org.schema";
import { writeAuditLog } from "../lib/audit";

const router = Router();

router.get("/departments", requireAuth, requireRole("Admin", "Manager", "Agent"), async (_req, res) => {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  res.json({ departments });
});

router.post("/departments", requireAuth, requireRole("Admin"), async (req, res) => {
  const body = createOrgUnitSchema.parse(req.body);
  const existing = await prisma.department.findUnique({ where: { name: body.name } });
  if (existing) throw Errors.conflict("A department with that name already exists");

  const department = await prisma.department.create({ data: { name: body.name } });
  await writeAuditLog(req.user!.id, "department.create", "Department", department.id, { name: department.name });
  res.status(201).json({ department });
});

router.patch("/departments/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Department not found");

  const body = updateOrgUnitSchema.parse(req.body);
  const department = await prisma.department.update({ where: { id }, data: body });
  res.json({ department });
});

router.get("/branches", requireAuth, requireRole("Admin", "Manager", "Agent"), async (_req, res) => {
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
  res.json({ branches });
});

router.post("/branches", requireAuth, requireRole("Admin"), async (req, res) => {
  const body = createOrgUnitSchema.parse(req.body);
  const existing = await prisma.branch.findUnique({ where: { name: body.name } });
  if (existing) throw Errors.conflict("A branch with that name already exists");

  const branch = await prisma.branch.create({ data: { name: body.name } });
  await writeAuditLog(req.user!.id, "branch.create", "Branch", branch.id, { name: branch.name });
  res.status(201).json({ branch });
});

router.patch("/branches/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Branch not found");

  const body = updateOrgUnitSchema.parse(req.body);
  const branch = await prisma.branch.update({ where: { id }, data: body });
  res.json({ branch });
});

export default router;
