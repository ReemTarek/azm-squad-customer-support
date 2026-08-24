import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { updateSlaPolicySchema } from "../validation/slaConfig.schema";
import { writeAuditLog } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, requireRole("Admin"), async (_req, res) => {
  const policies = await prisma.slaPolicy.findMany({ orderBy: { priority: "asc" } });
  res.json({ policies });
});

const VALID_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

router.patch("/:priority", requireAuth, requireRole("Admin"), async (req, res) => {
  const priorityParam = String(req.params.priority);
  if (!VALID_PRIORITIES.includes(priorityParam as (typeof VALID_PRIORITIES)[number])) {
    throw Errors.validation("priority must be one of Low, Medium, High, Urgent");
  }
  const priority = priorityParam as (typeof VALID_PRIORITIES)[number];

  const existing = await prisma.slaPolicy.findUnique({ where: { priority } });
  if (!existing) throw Errors.notFound("SLA policy not found for that priority");

  const body = updateSlaPolicySchema.parse(req.body);
  const policy = await prisma.slaPolicy.update({ where: { priority }, data: body });

  await writeAuditLog(req.user!.id, "sla-config.update", "SlaPolicy", policy.id, {
    priority,
    responseMinutes: body.responseMinutes,
    resolutionMinutes: body.resolutionMinutes,
  });

  res.json({ policy });
});

export default router;
